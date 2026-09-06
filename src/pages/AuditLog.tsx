import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Target, ShieldCheck, ArrowUpRight, TrendingUp, TrendingDown, Upload, Grid3x3 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { Transaction } from '../types';
import { CSVImport } from '../components/CSVImport';
import { ProAction } from '../components/ProAction';
import { WealthVsLifestyleChart } from '../components/WealthVsLifestyleChart';
import { currencyDef, getActiveCurrency } from '../lib/currency';

type Period = 'week' | 'month' | 'all';

function periodStart(period: Period): Date | null {
  if (period === 'all') return null;
  const d = new Date();
  if (period === 'week') { d.setDate(d.getDate() - 6); }
  else { d.setDate(1); }
  d.setHours(0, 0, 0, 0);
  return d;
}

const AuditPieChart = lazy(() => import('../components/AuditPieChart'));

const CATEGORY_LABELS: Record<string, string> = {
  FOOD: 'Food', TRANSPORT: 'Transport', FUN: 'Fun', SHOPPING: 'Shopping',
  HEALTH: 'Health', HOME: 'Home', WORK: 'Work', OTHER: 'Other',
  GENERAL: 'Other', SOCIAL: 'Splits', PENALTY: 'Penalties',
  VAULT_DEPOSIT: 'Vault', DEBT_PAYMENT: 'Debt', INCOME: 'Income', SAVINGS: 'Savings',
  BILL_PAYMENT: 'Bill',
  SUBSCRIPTION_PAYMENT: 'Subscription',
};

// ── Pivot Table ──────────────────────────────────────────────────────────────

type PivotInterval = 'month' | 'week';

// Categories ignored entirely (internal moves)
const PIVOT_EXCLUDED = new Set(['VAULT_TRANSFER', 'VAULT_WITHDRAWAL']);
// Categories that count as income in the NET TOTAL row
const PIVOT_INCOME_CATS = new Set(['INCOME']);
// Pre-committed obligations — shown below a divider, excluded from NET TOTAL
const PIVOT_ALLOCATED_CATS = new Set(['BILL_PAYMENT', 'SUBSCRIPTION_PAYMENT', 'DEBT_PAYMENT']);

const NUM_INTERVALS = 6;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}
// ISO week start (Monday) as YYYY-MM-DD
function weekKey(d: Date): string {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const dow = (day.getDay() + 6) % 7; // 0 = Monday
  day.setDate(day.getDate() - dow);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}
function weekLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface PivotRow {
  category: string;
  label: string;
  isIncome: boolean;
  isAllocated: boolean;
  values: number[];
  total: number;
  average: number;
}
interface PivotMatrix {
  intervals: string[];
  intervalLabels: string[];
  rows: PivotRow[];
  netRow: { values: number[]; total: number; average: number };          // income − discretionary
  allocatedRow: { values: number[]; total: number; average: number };   // bill + debt subtotal
}

function buildPivot(transactions: Transaction[], interval: PivotInterval): PivotMatrix {
  const keyFn = interval === 'month' ? monthKey : weekKey;
  const labelFn = interval === 'month' ? monthLabel : weekLabel;

  // 1. Collect last N interval keys (relative to today)
  const intervals: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = NUM_INTERVALS - 1; i >= 0; i--) {
    const d = new Date(today);
    if (interval === 'month') d.setMonth(d.getMonth() - i);
    else                       d.setDate(d.getDate() - i * 7);
    intervals.push(keyFn(d));
  }

  // 2. Sum tx amount (incl flipAmount) by category × interval
  const cellMap: Record<string, Record<string, number>> = {};
  for (const tx of transactions) {
    if (PIVOT_EXCLUDED.has(tx.category)) continue;
    const k = keyFn(new Date(tx.date));
    if (!intervals.includes(k)) continue;
    if (!cellMap[tx.category]) cellMap[tx.category] = {};
    cellMap[tx.category][k] = (cellMap[tx.category][k] ?? 0) + tx.amount + (tx.flipAmount || 0);
  }

  // 3. Build row objects
  const categories = Object.keys(cellMap).sort((a, b) => {
    // INCOME first, then allocated last, then alphabetical by label
    if (PIVOT_INCOME_CATS.has(a) && !PIVOT_INCOME_CATS.has(b)) return -1;
    if (PIVOT_INCOME_CATS.has(b) && !PIVOT_INCOME_CATS.has(a)) return 1;
    if (PIVOT_ALLOCATED_CATS.has(a) && !PIVOT_ALLOCATED_CATS.has(b)) return 1;
    if (PIVOT_ALLOCATED_CATS.has(b) && !PIVOT_ALLOCATED_CATS.has(a)) return -1;
    return (CATEGORY_LABELS[a] ?? a).localeCompare(CATEGORY_LABELS[b] ?? b);
  });

  const rows: PivotRow[] = categories.map(cat => {
    const values = intervals.map(k => cellMap[cat]?.[k] ?? 0);
    const total = values.reduce((s, v) => s + v, 0);
    return {
      category: cat,
      label: CATEGORY_LABELS[cat] ?? cat,
      isIncome: PIVOT_INCOME_CATS.has(cat),
      isAllocated: PIVOT_ALLOCATED_CATS.has(cat),
      values,
      total,
      average: total / NUM_INTERVALS,
    };
  });

  // 4. Net row: true cash flow = income − everything (discretionary + committed
  // obligations). Bills are real money out, so they count toward the net even
  // though they're also listed separately under "Committed Capital" below.
  const netValues = intervals.map((_, i) => {
    let income = 0, spend = 0;
    for (const r of rows) {
      if (r.isIncome) income += r.values[i];
      else            spend  += r.values[i];
    }
    return income - spend;
  });
  const netTotal = netValues.reduce((s, v) => s + v, 0);

  // 5. Allocated subtotal row (bill + debt)
  const allocatedValues = intervals.map((_, i) =>
    rows.filter(r => r.isAllocated).reduce((s, r) => s + r.values[i], 0)
  );
  const allocatedTotal = allocatedValues.reduce((s, v) => s + v, 0);

  return {
    intervals,
    intervalLabels: intervals.map(labelFn),
    rows,
    netRow:       { values: netValues,       total: netTotal,       average: netTotal / NUM_INTERVALS },
    allocatedRow: { values: allocatedValues, total: allocatedTotal, average: allocatedTotal / NUM_INTERVALS },
  };
}

// Full currency in the user's chosen currency so the pivot reconciles exactly.
// `tabular-nums` on cells keeps digits column-aligned.
function formatCell(n: number): string {
  const def = currencyDef(getActiveCurrency());
  try {
    return n.toLocaleString(def.locale, { style: 'currency', currency: def.code });
  } catch {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }
}

const PivotTable: React.FC = () => {
  const transactions = useStore(s => s.transactions);
  const [interval, setInterval] = useState<PivotInterval>('month');

  const matrix = useMemo(() => buildPivot(transactions, interval), [transactions, interval]);

  if (matrix.rows.length === 0) {
    return (
      <div className="bg-surface border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black border-2 border-black rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase">
            <Grid3x3 size={11} /> Pivot Analytics
          </div>
        </div>
        <div className="text-center py-10">
          <Grid3x3 size={42} className="mx-auto mb-3 text-text-muted opacity-30" />
          <p className="text-[11px] font-black uppercase tracking-widest text-text-muted">
            No transactions yet · log spending or income to build the pivot
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border-4 border-black rounded-3xl shadow-[6px_6px_0px_0px_var(--shadow-color)] overflow-hidden">
      <div className="p-5 pb-3 flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black border-2 border-black rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase">
          <Grid3x3 size={11} /> Pivot Analytics
        </div>
        <div className="flex gap-1 p-1 bg-input border-2 border-border rounded-full">
          {(['month', 'week'] as PivotInterval[]).map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setInterval(i)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                interval === i
                  ? 'bg-black text-action-primary shadow-[2px_2px_0px_0px_var(--color-action-primary)]'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {i === 'month' ? 'Monthly View' : 'Weekly View'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse tabular-nums">
          <thead>
            <tr className="bg-input">
              <th className="sticky left-0 z-20 bg-input border-b-2 border-r-2 border-border px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-text-muted min-w-35">
                Category
              </th>
              {matrix.intervalLabels.map(label => (
                <th
                  key={label}
                  className="border-b-2 border-border px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-text-muted min-w-20"
                >
                  {label}
                </th>
              ))}
              <th className="border-b-2 border-l-2 border-border px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-text-muted min-w-20">
                Total
              </th>
              <th className="border-b-2 border-border px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-text-muted min-w-20">
                Avg
              </th>
            </tr>
          </thead>
          <tbody>
            {/* ── Discretionary rows (income + variable spend) ── */}
            {matrix.rows.filter(r => !r.isAllocated).map((row, rowIdx) => {
              const rowTone = row.isIncome ? 'text-capture-readable' : 'text-text-main';
              return (
                <tr key={row.category} className={rowIdx % 2 === 0 ? 'bg-surface' : 'bg-input/30'}>
                  <td className={`sticky left-0 z-10 ${rowIdx % 2 === 0 ? 'bg-surface' : 'bg-input/30'} border-b border-r-2 border-border/40 px-4 py-2.5 text-left text-[11px] font-black uppercase tracking-wide ${rowTone}`}>
                    {row.label}
                  </td>
                  {row.values.map((v, i) => (
                    <td key={i} className="border-b border-border/30 px-4 py-2.5 text-right text-[11px] font-bold">
                      {v === 0
                        ? <span className="text-text-muted/30">—</span>
                        : <span className={row.isIncome ? 'text-capture-readable' : 'text-text-main'}>{formatCell(v)}</span>
                      }
                    </td>
                  ))}
                  <td className={`border-b border-l-2 border-border/40 px-4 py-2.5 text-right text-[11px] font-black ${rowTone}`}>
                    {row.total === 0 ? <span className="text-text-muted/30">—</span> : formatCell(row.total)}
                  </td>
                  <td className={`border-b border-border/30 px-4 py-2.5 text-right text-[11px] font-bold ${rowTone}`}>
                    {row.average === 0 ? <span className="text-text-muted/30">—</span> : formatCell(row.average)}
                  </td>
                </tr>
              );
            })}

            {/* ── NET TOTAL (income − discretionary only) ── */}
            <tr className="bg-action-primary/10 border-t-2 border-b-2 border-border">
              <td className="sticky left-0 z-10 bg-action-primary/10 border-r-2 border-border px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-action-primary">
                Net Total
              </td>
              {matrix.netRow.values.map((v, i) => (
                <td key={i} className="px-4 py-3 text-right text-[11px] font-black tabular-nums">
                  {v === 0
                    ? <span className="text-text-muted/30">—</span>
                    : <span className={v > 0 ? 'text-action-capture' : 'text-action-bleed'}>
                        {v > 0 ? '+' : '−'}{formatCell(Math.abs(v))}
                      </span>
                  }
                </td>
              ))}
              <td className="border-l-2 border-border px-4 py-3 text-right text-[11px] font-black tabular-nums">
                {matrix.netRow.total === 0
                  ? <span className="text-text-muted/30">—</span>
                  : <span className={matrix.netRow.total > 0 ? 'text-action-capture' : 'text-action-bleed'}>
                      {matrix.netRow.total > 0 ? '+' : '−'}{formatCell(Math.abs(matrix.netRow.total))}
                    </span>
                }
              </td>
              <td className="px-4 py-3 text-right text-[11px] font-black tabular-nums">
                {matrix.netRow.average === 0
                  ? <span className="text-text-muted/30">—</span>
                  : <span className={matrix.netRow.average > 0 ? 'text-action-capture' : 'text-action-bleed'}>
                      {matrix.netRow.average > 0 ? '+' : '−'}{formatCell(Math.abs(matrix.netRow.average))}
                    </span>
                }
              </td>
            </tr>

            {/* ── Allocated obligations divider + rows ── */}
            {matrix.rows.some(r => r.isAllocated) && (<>
              <tr>
                <td
                  colSpan={matrix.intervals.length + 3}
                  className="px-4 py-1.5 bg-input border-y border-border/60"
                >
                  <span className="text-[9px] font-black uppercase tracking-[0.15em] text-text-muted/50">
                    Committed Capital
                  </span>
                </td>
              </tr>
              {matrix.rows.filter(r => r.isAllocated).map((row, rowIdx) => (
                <tr key={row.category} className={rowIdx % 2 === 0 ? 'bg-input/20' : 'bg-input/40'}>
                  <td className={`sticky left-0 z-10 ${rowIdx % 2 === 0 ? 'bg-input/20' : 'bg-input/40'} border-b border-r-2 border-border/30 px-4 py-2.5 text-left text-[11px] font-black uppercase tracking-wide text-text-muted`}>
                    {row.label}
                  </td>
                  {row.values.map((v, i) => (
                    <td key={i} className="border-b border-border/20 px-4 py-2.5 text-right text-[11px] font-bold text-text-muted">
                      {v === 0 ? <span className="text-text-muted/20">—</span> : formatCell(v)}
                    </td>
                  ))}
                  <td className="border-b border-l-2 border-border/30 px-4 py-2.5 text-right text-[11px] font-black text-text-muted">
                    {row.total === 0 ? <span className="text-text-muted/20">—</span> : formatCell(row.total)}
                  </td>
                  <td className="border-b border-border/20 px-4 py-2.5 text-right text-[11px] font-bold text-text-muted">
                    {row.average === 0 ? <span className="text-text-muted/20">—</span> : formatCell(row.average)}
                  </td>
                </tr>
              ))}
              {matrix.allocatedRow.total > 0 && (
                <tr className="bg-input/50 border-t border-border/40">
                  <td className="sticky left-0 z-10 bg-input/50 border-r-2 border-border/30 px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-text-muted/70">
                    Total Committed
                  </td>
                  {matrix.allocatedRow.values.map((v, i) => (
                    <td key={i} className="px-4 py-2.5 text-right text-[11px] font-black text-text-muted/70 tabular-nums">
                      {v === 0 ? <span className="text-text-muted/20">—</span> : formatCell(v)}
                    </td>
                  ))}
                  <td className="border-l-2 border-border/30 px-4 py-2.5 text-right text-[11px] font-black text-text-muted/70 tabular-nums">
                    {formatCell(matrix.allocatedRow.total)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[11px] font-bold text-text-muted/70 tabular-nums">
                    {formatCell(matrix.allocatedRow.average)}
                  </td>
                </tr>
              )}
            </>)}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const AuditLog: React.FC = () => {
  const transactions = useStore(s => s.transactions);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoadChart, setShouldLoadChart] = useState(false);
  const [period, setPeriod] = useState<Period>('month');
  const [csvOpen, setCsvOpen] = useState(false);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    setShouldLoadChart(false);
  };

  const filteredTransactions = useMemo(() => {
    const start = periodStart(period);
    if (!start) return transactions;
    return transactions.filter(tx => new Date(tx.date) >= start);
  }, [transactions, period]);

  const { totalOutflow, wealthCaptured, totalAllocated, chartData, allocatedItems, totalCommitted, committedItems } = useMemo(() => {
    let total = 0;
    // Captured wealth = savings plus money moved into vaults / investments.
    const CAPTURED_CATEGORIES = new Set(['SAVINGS', 'VAULT_DEPOSIT']);
    // Allocated = pre-reserved obligations (debt principal, recurring bills).
    // These get their own panel and stay out of the discretionary spend pie chart.
    const ALLOCATED_CATEGORIES = new Set(['DEBT_PAYMENT', 'BILL_PAYMENT', 'SUBSCRIPTION_PAYMENT']);
    const INTERNAL_CATEGORIES  = new Set(['VAULT_TRANSFER', 'VAULT_WITHDRAWAL']);

    const grouped = filteredTransactions
      .filter(tx => !CAPTURED_CATEGORIES.has(tx.category) && !ALLOCATED_CATEGORIES.has(tx.category) && tx.category !== 'INCOME' && !INTERNAL_CATEGORIES.has(tx.category))
      .reduce((acc, tx) => {
        const key = CATEGORY_LABELS[tx.category] ?? tx.category;
        if (!acc[key]) acc[key] = { name: key, base: 0, impulse: 0 };
        if (tx.category === 'PENALTY') {
          acc[key].impulse += tx.amount + tx.flipAmount;
        } else {
          acc[key].base += tx.amount;
          acc[key].impulse += tx.flipAmount;
        }
        return acc;
      }, {} as Record<string, { name: string; base: number; impulse: number }>);

    const formatted = Object.values(grouped).map(item => {
      const itemTotal = item.base + item.impulse;
      total += itemTotal;
      return { ...item, total: itemTotal, color: item.impulse > item.base ? '#FF4D4D' : '#000000' };
    }).filter(i => i.total > 0);

    const captured = filteredTransactions
      .filter(tx => CAPTURED_CATEGORIES.has(tx.category))
      .reduce((acc, tx) => acc + tx.amount, 0);

    // Capital Allocated = deliberate net-worth moves (debt principal payoff).
    // Bills are NOT allocated capital — they're fixed obligations, tracked separately.
    const allocatedGrouped = filteredTransactions
      .filter(tx => tx.category === 'DEBT_PAYMENT')
      .reduce((acc, tx) => {
        const key = 'Debt Payments';
        if (!acc[key]) acc[key] = { name: key, total: 0 };
        acc[key].total += tx.amount;
        return acc;
      }, {} as Record<string, { name: string; total: number }>);

    const allocated = Object.values(allocatedGrouped);
    const totalAlloc = allocated.reduce((acc, a) => acc + a.total, 0);

    // Committed = recurring fixed obligations (bills) you're required to pay.
    const committedGrouped = filteredTransactions
      .filter(tx => tx.category === 'BILL_PAYMENT')
      .reduce((acc, tx) => {
        const key = 'Bill Payments';
        if (!acc[key]) acc[key] = { name: key, total: 0 };
        acc[key].total += tx.amount;
        return acc;
      }, {} as Record<string, { name: string; total: number }>);

    const committed = Object.values(committedGrouped);
    const totalCommit = committed.reduce((acc, c) => acc + c.total, 0);

    return {
      totalOutflow: total,
      wealthCaptured: captured,
      totalAllocated: totalAlloc,
      chartData: formatted,
      allocatedItems: allocated,
      totalCommitted: totalCommit,
      committedItems: committed,
    };
  }, [filteredTransactions]);

  // Month-over-month spending comparison (always calendar-based, ignores period filter)
  const spendingComparison = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // MoM compares discretionary spend only — bills, debt, vault funding are pre-reserved.
    const EXCLUDED = new Set(['INCOME', 'SAVINGS', 'VAULT_DEPOSIT', 'DEBT_PAYMENT', 'BILL_PAYMENT', 'SUBSCRIPTION_PAYMENT', 'VAULT_TRANSFER', 'VAULT_WITHDRAWAL']);

    const spendFor = (start: Date, end: Date) => {
      const cats: Record<string, number> = {};
      let total = 0;
      transactions.forEach(tx => {
        const d = new Date(tx.date);
        if (d >= start && d < end && !EXCLUDED.has(tx.category)) {
          const spend = tx.amount + tx.flipAmount;
          total += spend;
          const key = CATEGORY_LABELS[tx.category] ?? tx.category;
          cats[key] = (cats[key] ?? 0) + spend;
        }
      });
      return { total, cats };
    };

    const thisMonth = spendFor(thisMonthStart, thisMonthEnd);
    const lastMonth = spendFor(lastMonthStart, thisMonthStart);
    const delta = thisMonth.total - lastMonth.total;
    const pct = lastMonth.total > 0 ? (delta / lastMonth.total) * 100 : null;

    const allCats = new Set([...Object.keys(thisMonth.cats), ...Object.keys(lastMonth.cats)]);
    const categories = Array.from(allCats)
      .map(cat => ({ name: cat, thisMonth: thisMonth.cats[cat] ?? 0, lastMonth: lastMonth.cats[cat] ?? 0 }))
      .sort((a, b) => b.thisMonth - a.thisMonth)
      .slice(0, 5);

    return { thisMonth: thisMonth.total, lastMonth: lastMonth.total, delta, pct, categories };
  }, [transactions]);

  useEffect(() => {
    if (shouldLoadChart || chartData.length === 0) return;
    const container = chartContainerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') {
      setShouldLoadChart(true);
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setShouldLoadChart(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px 0px' }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [chartData.length, shouldLoadChart]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Audit Log</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Spending breakdown</p>
        </div>
        <div className="flex items-center gap-2">
        <ProAction feature="import">
          <button
            type="button"
            onClick={() => setCsvOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-input border-2 border-border rounded-full text-[10px] font-black uppercase tracking-widest text-text-muted hover:border-black hover:text-text-main transition-all"
          >
            <Upload size={12} strokeWidth={2.5} /> Import CSV
          </button>
        </ProAction>
        <div className="flex gap-1 p-1 bg-input border-2 border-border rounded-full w-fit">
          {(['week', 'month', 'all'] as Period[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => handlePeriodChange(p)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                period === p
                  ? 'bg-black text-action-primary shadow-[2px_2px_0px_0px_var(--color-action-primary)]'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {p === 'week' ? '7D' : p === 'month' ? 'MTD' : 'ALL'}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-action-bleed border-2 border-black rounded-full text-white text-[10px] font-black tracking-widest uppercase mb-3">
            <Activity size={11} /> TOTAL OUTFLOW
          </div>
          <p className="text-3xl sm:text-4xl font-black italic tracking-tighter text-action-bleed tabular-nums">-{formatCell(totalOutflow)}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-2">Pure spend + penalties</p>
        </div>
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-action-capture border-2 border-black rounded-full text-capture-contrast text-[10px] font-black tracking-widest uppercase mb-3">
            <ShieldCheck size={11} /> WEALTH CAPTURED
          </div>
          <p className="text-3xl sm:text-4xl font-black italic tracking-tighter text-capture-readable tabular-nums">+{formatCell(wealthCaptured)}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-2">Savings captures and vault deposits</p>
        </div>
      </div>

      {/* Pivot Analytics */}
      <PivotTable />

      {/* Wealth vs Lifestyle — this month's split between future-building and discretionary spend */}
      <WealthVsLifestyleChart />

      {/* Month vs Last Month */}
      {(spendingComparison.thisMonth > 0 || spendingComparison.lastMonth > 0) && (
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black border-2 border-black rounded-full text-white text-[10px] font-black tracking-widest uppercase mb-4">
            <TrendingUp size={11} /> VS LAST MONTH
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-1">This Month</p>
              <p className="text-2xl font-black italic tracking-tighter text-text-main tabular-nums">
                {formatCell(spendingComparison.thisMonth)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-1">Last Month</p>
              <p className="text-2xl font-black italic tracking-tighter text-text-muted tabular-nums">
                {formatCell(spendingComparison.lastMonth)}
              </p>
            </div>
          </div>

          {spendingComparison.lastMonth > 0 && (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 border-black mb-5 ${
              spendingComparison.delta <= 0 ? 'bg-action-capture text-capture-contrast' : 'bg-action-bleed text-white'
            }`}>
              {spendingComparison.delta <= 0
                ? <TrendingDown size={13} strokeWidth={2.5} />
                : <TrendingUp size={13} strokeWidth={2.5} />
              }
              <span className="text-[10px] font-black uppercase tracking-widest">
                {spendingComparison.delta <= 0
                  ? `${formatCell(Math.abs(spendingComparison.delta))} under`
                  : `${formatCell(Math.abs(spendingComparison.delta))} over`
                }
                {spendingComparison.pct !== null && ` (${Math.abs(spendingComparison.pct).toFixed(0)}%)`}
              </span>
            </div>
          )}

          {spendingComparison.categories.length > 0 && (
            <div className="space-y-3 border-t-2 border-border/30 pt-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">By Category</p>
              {spendingComparison.categories.map(cat => {
                const max = Math.max(cat.thisMonth, cat.lastMonth, 1);
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{cat.name}</span>
                      <div className="flex items-center gap-2 text-[10px] font-black tabular-nums">
                        <span className={cat.thisMonth > cat.lastMonth ? 'text-action-bleed' : 'text-text-main'}>
                          {formatCell(cat.thisMonth)}
                        </span>
                        <span className="text-text-muted/40">vs</span>
                        <span className="text-text-muted">{formatCell(cat.lastMonth)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-input rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${cat.thisMonth > cat.lastMonth ? 'bg-action-bleed' : 'bg-action-capture'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${(cat.thisMonth / max) * 100}%` }}
                        transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                      />
                    </div>
                    <div className="h-1 mt-0.5 bg-input rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-border"
                        initial={{ width: 0 }}
                        animate={{ width: `${(cat.lastMonth / max) * 100}%` }}
                        transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-5 pt-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 rounded-full bg-action-capture" />
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wide">This month</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-1 rounded-full bg-border" />
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wide">Last month</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div ref={chartContainerRef} className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black border-2 border-black rounded-full text-white text-[10px] font-black tracking-widest uppercase mb-4">
            <Target size={11} /> SPEND BREAKDOWN
          </div>
          {shouldLoadChart ? (
            <Suspense
              fallback={
                <div className="w-full h-56 flex items-center justify-center bg-input border-2 border-border rounded-2xl">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Loading Chart</p>
                </div>
              }
            >
              <AuditPieChart data={chartData} />
            </Suspense>
          ) : (
            <div className="w-full h-56 flex items-center justify-center bg-input border-2 border-border rounded-2xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Chart loads on scroll</p>
            </div>
          )}
        </div>
      )}

      {/* Capital Allocated — deliberate net-worth moves (debt payoff) */}
      {allocatedItems.length > 0 && (
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black border-2 border-action-primary rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase mb-3">
            <ArrowUpRight size={11} /> CAPITAL ALLOCATED
          </div>
          <p className="text-3xl sm:text-4xl font-black italic tracking-tighter text-text-main tabular-nums mb-1">
            {formatCell(totalAllocated)}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-4">Deliberately moved · debt principal payoff</p>
          <div className="space-y-2">
            {allocatedItems.map(item => (
              <div key={item.name} className="flex justify-between items-center bg-input border-2 border-border rounded-2xl px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{item.name}</span>
                <span className="font-black italic text-text-main tabular-nums">{formatCell(item.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Committed — recurring fixed obligations (bills) */}
      {committedItems.length > 0 && (
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black border-2 border-action-bleed rounded-full text-action-bleed text-[10px] font-black tracking-widest uppercase mb-3">
            <ShieldCheck size={11} /> COMMITTED
          </div>
          <p className="text-3xl sm:text-4xl font-black italic tracking-tighter text-text-main tabular-nums mb-1">
            {formatCell(totalCommitted)}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-4">Fixed obligations · bills you're required to pay</p>
          <div className="space-y-2">
            {committedItems.map(item => (
              <div key={item.name} className="flex justify-between items-center bg-input border-2 border-border rounded-2xl px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{item.name}</span>
                <span className="font-black italic text-text-main tabular-nums">{formatCell(item.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {csvOpen && <CSVImport onClose={() => setCsvOpen(false)} />}
      </AnimatePresence>
    </div>
  );
};
