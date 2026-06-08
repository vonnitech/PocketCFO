import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Target, ShieldAlert, ShieldCheck, ArrowUpRight, Search, X, TrendingUp, TrendingDown, Upload, Grid3x3 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { Transaction } from '../types';
import { CSVImport } from '../components/CSVImport';

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
};

const CATEGORY_COLORS: Record<string, string> = {
  FOOD:      'bg-input text-text-muted border-border',
  TRANSPORT: 'bg-input text-text-muted border-border',
  FUN:       'bg-input text-text-muted border-border',
  SHOPPING:  'bg-input text-text-muted border-border',
  HEALTH:    'bg-input text-text-muted border-border',
  HOME:      'bg-input text-text-muted border-border',
  WORK:      'bg-input text-text-muted border-border',
  SOCIAL:    'bg-input text-text-muted border-border',
  PENALTY:   'bg-action-bleed/20 text-action-bleed border-action-bleed/40',
  VAULT_DEPOSIT: 'bg-action-capture/20 text-capture-readable border-action-capture/40',
  DEBT_PAYMENT:  'bg-action-primary/20 text-black border-action-primary/40',
  INCOME:    'bg-action-capture/20 text-capture-readable border-action-capture/40',
  SAVINGS:   'bg-action-capture/20 text-capture-readable border-action-capture/40',
};

function catBadge(category: string) {
  const label = CATEGORY_LABELS[category] ?? category;
  const color = CATEGORY_COLORS[category] ?? 'bg-input text-text-muted border-border';
  return { label, color };
}

// ── Pivot Table ──────────────────────────────────────────────────────────────

type PivotInterval = 'month' | 'week';

// Categories ignored entirely (internal moves)
const PIVOT_EXCLUDED = new Set(['VAULT_TRANSFER', 'VAULT_WITHDRAWAL']);
// Categories that count as income in the NET TOTAL row
const PIVOT_INCOME_CATS = new Set(['INCOME']);

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

interface PivotMatrix {
  intervals: string[];          // column keys, oldest → newest
  intervalLabels: string[];     // human-friendly labels
  rows: { category: string; label: string; isIncome: boolean; values: number[]; total: number; average: number }[];
  netRow: { values: number[]; total: number; average: number };
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
    // INCOME first, then alphabetical by label
    if (PIVOT_INCOME_CATS.has(a) && !PIVOT_INCOME_CATS.has(b)) return -1;
    if (PIVOT_INCOME_CATS.has(b) && !PIVOT_INCOME_CATS.has(a)) return 1;
    return (CATEGORY_LABELS[a] ?? a).localeCompare(CATEGORY_LABELS[b] ?? b);
  });

  const rows = categories.map(cat => {
    const values = intervals.map(k => cellMap[cat]?.[k] ?? 0);
    const total = values.reduce((s, v) => s + v, 0);
    return {
      category: cat,
      label: CATEGORY_LABELS[cat] ?? cat,
      isIncome: PIVOT_INCOME_CATS.has(cat),
      values,
      total,
      average: total / NUM_INTERVALS,
    };
  });

  // 4. Net row: income - spend per interval
  const netValues = intervals.map((_, i) => {
    let income = 0, spend = 0;
    for (const r of rows) {
      if (r.isIncome) income += r.values[i];
      else            spend  += r.values[i];
    }
    return income - spend;
  });
  const netTotal = netValues.reduce((s, v) => s + v, 0);

  return {
    intervals,
    intervalLabels: intervals.map(labelFn),
    rows,
    netRow: { values: netValues, total: netTotal, average: netTotal / NUM_INTERVALS },
  };
}

// Always show full currency with two decimals so the pivot reconciles exactly.
// `tabular-nums` on cells keeps digits column-aligned.
function formatCell(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
            {matrix.rows.map((row, rowIdx) => {
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
            <tr className="bg-black">
              <td className="sticky left-0 z-10 bg-black border-r-2 border-border px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-action-primary">
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
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const Audit: React.FC = () => {
  const transactions = useStore(s => s.transactions);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoadChart, setShouldLoadChart] = useState(false);
  const [period, setPeriod] = useState<Period>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    setShouldLoadChart(false);
    setCategoryFilter(null);
    setSearchQuery('');
  };

  const filteredTransactions = useMemo(() => {
    const start = periodStart(period);
    if (!start) return transactions;
    return transactions.filter(tx => new Date(tx.date) >= start);
  }, [transactions, period]);

  const { totalOutflow, wealthCaptured, totalAllocated, chartData, rankedCategories, allocatedItems } = useMemo(() => {
    let total = 0;
    // Allocated = pre-reserved money (vault funding, debt principal, recurring bills).
    // These get their own panel and stay out of the discretionary spend pie chart.
    const ALLOCATED_CATEGORIES = new Set(['VAULT_DEPOSIT', 'DEBT_PAYMENT', 'BILL_PAYMENT']);
    const INTERNAL_CATEGORIES  = new Set(['VAULT_TRANSFER', 'VAULT_WITHDRAWAL']);

    const grouped = filteredTransactions
      .filter(tx => tx.category !== 'SAVINGS' && !ALLOCATED_CATEGORIES.has(tx.category) && tx.category !== 'INCOME' && !INTERNAL_CATEGORIES.has(tx.category))
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
      .filter(tx => tx.category === 'SAVINGS')
      .reduce((acc, tx) => acc + tx.amount, 0);

    const allocatedGrouped = filteredTransactions
      .filter(tx => ALLOCATED_CATEGORIES.has(tx.category))
      .reduce((acc, tx) => {
        const key = tx.category === 'VAULT_DEPOSIT'
          ? 'Vault Deposits'
          : tx.category === 'BILL_PAYMENT'
          ? 'Bill Payments'
          : 'Debt Payments';
        if (!acc[key]) acc[key] = { name: key, total: 0 };
        acc[key].total += tx.amount;
        return acc;
      }, {} as Record<string, { name: string; total: number }>);

    const allocated = Object.values(allocatedGrouped);
    const totalAlloc = allocated.reduce((acc, a) => acc + a.total, 0);

    return {
      totalOutflow: total,
      wealthCaptured: captured,
      totalAllocated: totalAlloc,
      chartData: formatted,
      rankedCategories: formatted.sort((a, b) => b.total - a.total),
      allocatedItems: allocated,
    };
  }, [filteredTransactions]);

  // Unique categories present in the current period for filter pills
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    filteredTransactions.forEach(tx => {
      if (tx.category !== 'INCOME') cats.add(tx.category);
    });
    return Array.from(cats).sort();
  }, [filteredTransactions]);

  // Month-over-month spending comparison (always calendar-based, ignores period filter)
  const spendingComparison = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // MoM compares discretionary spend only — bills, debt, vault funding are pre-reserved.
    const EXCLUDED = new Set(['INCOME', 'SAVINGS', 'VAULT_DEPOSIT', 'DEBT_PAYMENT', 'BILL_PAYMENT', 'VAULT_TRANSFER', 'VAULT_WITHDRAWAL']);

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

  // Individual transaction list filtered by search + category
  const displayTransactions = useMemo(() => {
    return filteredTransactions
      .filter(tx => {
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch = q === '' || tx.merchant.toLowerCase().includes(q) || tx.category.toLowerCase().includes(q);
        const matchesCategory = categoryFilter === null || tx.category === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredTransactions, searchQuery, categoryFilter]);

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

  const hasActiveFilter = searchQuery.trim() !== '' || categoryFilter !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Audit Log</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Spending breakdown</p>
        </div>
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCsvOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-input border-2 border-border rounded-full text-[10px] font-black uppercase tracking-widest text-text-muted hover:border-black hover:text-text-main transition-all"
        >
          <Upload size={12} strokeWidth={2.5} /> Import CSV
        </button>
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
          <p className="text-3xl sm:text-4xl font-black italic tracking-tighter text-action-bleed tabular-nums">-${totalOutflow.toFixed(2)}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-2">Pure spend + penalties</p>
        </div>
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-action-capture border-2 border-black rounded-full text-capture-contrast text-[10px] font-black tracking-widest uppercase mb-3">
            <ShieldCheck size={11} /> WEALTH CAPTURED
          </div>
          <p className="text-3xl sm:text-4xl font-black italic tracking-tighter text-capture-readable tabular-nums">+${wealthCaptured.toFixed(2)}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-2">Captured penalties and savings transfers</p>
        </div>
      </div>

      {/* Pivot Analytics */}
      <PivotTable />

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
                ${spendingComparison.thisMonth.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-1">Last Month</p>
              <p className="text-2xl font-black italic tracking-tighter text-text-muted tabular-nums">
                ${spendingComparison.lastMonth.toFixed(2)}
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
                  ? `$${Math.abs(spendingComparison.delta).toFixed(2)} under`
                  : `$${Math.abs(spendingComparison.delta).toFixed(2)} over`
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
                          ${cat.thisMonth.toFixed(2)}
                        </span>
                        <span className="text-text-muted/40">vs</span>
                        <span className="text-text-muted">${cat.lastMonth.toFixed(2)}</span>
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

      {/* Capital Allocated */}
      {allocatedItems.length > 0 && (
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black border-2 border-action-primary rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase mb-3">
            <ArrowUpRight size={11} /> CAPITAL ALLOCATED
          </div>
          <p className="text-3xl sm:text-4xl font-black italic tracking-tighter text-text-main tabular-nums mb-1">
            ${totalAllocated.toFixed(2)}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-4">Deliberately moved · vaults and debt payments</p>
          <div className="space-y-2">
            {allocatedItems.map(item => (
              <div key={item.name} className="flex justify-between items-center bg-input border-2 border-border rounded-2xl px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{item.name}</span>
                <span className="font-black italic text-text-main tabular-nums">${item.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-3">Expense Analysis</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rankedCategories.map(category => (
          <div
            key={category.name}
            className={`bg-surface border-4 rounded-2xl p-4 flex justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)] ${
              category.impulse > category.base ? 'border-action-bleed' : 'border-border'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-black text-sm uppercase tracking-tighter text-text-main flex items-center gap-2 truncate">
                <span className="truncate">{category.name}</span>
                {category.impulse > category.base && <ShieldAlert size={14} className="text-action-bleed shrink-0" />}
              </p>
              {category.impulse > 0 && (
                <div className="flex gap-3 mt-1 text-[10px] font-bold uppercase text-text-muted flex-wrap">
                  <span>Base: ${category.base.toFixed(2)}</span>
                  <span className="text-action-bleed font-black">Taxed: ${category.impulse.toFixed(2)}</span>
                </div>
              )}
            </div>
            <span className={`font-black text-lg sm:text-xl italic shrink-0 ml-2 tabular-nums ${category.impulse > category.base ? 'text-action-bleed' : 'text-text-main'}`}>
              ${category.total.toFixed(2)}
            </span>
          </div>
        ))}

        {rankedCategories.length === 0 && (
          <div className="text-center py-16 bg-surface border-4 border-dashed border-border rounded-3xl md:col-span-2">
            <Activity size={48} className="mx-auto mb-4 text-text-muted opacity-30" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">No transactions logged yet.</p>
          </div>
        )}
        </div>
      </div>

      {/* Transaction Search + Filter */}
      {filteredTransactions.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Transaction Log</p>

          {/* Search input */}
          <div className="relative">
            <Search size={16} strokeWidth={2.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="search"
              inputMode="search"
              placeholder="Search merchant or category..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-14 bg-input border-4 border-black rounded-2xl pl-12 pr-4 font-black text-sm text-text-main placeholder:text-text-muted focus:bg-surface focus:border-action-capture outline-none transition-colors mb-4 tabular-nums"
            />
            {searchQuery && (
              <button
                type="button"
                title="Clear search"
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-[calc(50%-0.5rem)] -translate-y-1/2 text-text-muted hover:text-text-main"
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Category filter pills */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className={`px-3 py-1.5 rounded-full border-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                categoryFilter === null
                  ? 'bg-black border-black text-white'
                  : 'bg-input border-border text-text-muted hover:border-black hover:text-text-main'
              }`}
            >
              All
            </button>
            {availableCategories.map(cat => {
              const { label } = catBadge(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                  className={`px-3 py-1.5 rounded-full border-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                    categoryFilter === cat
                      ? 'bg-black border-black text-white'
                      : 'bg-input border-border text-text-muted hover:border-black hover:text-text-main'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Results count */}
          {hasActiveFilter && (
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                {displayTransactions.length} result{displayTransactions.length !== 1 ? 's' : ''}
              </p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setCategoryFilter(null); }}
                className="text-[10px] font-black uppercase tracking-widest text-action-bleed hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Transaction rows */}
          <div className="space-y-2">
            {displayTransactions.map(tx => {
              const { label, color } = catBadge(tx.category);
              const date = new Date(tx.date);
              const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const isIncome = tx.category === 'INCOME';
              return (
                <div
                  key={tx.id}
                  className="bg-surface border-2 border-border rounded-2xl px-4 py-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-text-main truncate">{tx.merchant}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] font-bold text-text-muted">{dateStr}</span>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${color}`}>
                        {label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-black text-sm tabular-nums ${isIncome ? 'text-capture-readable' : 'text-text-main'}`}>
                      {isIncome ? '+' : '-'}${tx.amount.toFixed(2)}
                    </p>
                    {tx.flipAmount > 0 && (
                      <p className="text-[10px] font-bold text-action-bleed tabular-nums">+${tx.flipAmount.toFixed(2)} tax</p>
                    )}
                  </div>
                </div>
              );
            })}

            {displayTransactions.length === 0 && hasActiveFilter && (
              <div className="text-center py-12 bg-surface border-2 border-dashed border-border rounded-3xl px-6">
                <Search size={36} className="mx-auto mb-3 text-text-muted opacity-30" />
                <p className="text-[11px] font-black uppercase tracking-widest text-text-muted">
                  {searchQuery.trim()
                    ? `No matches for "${searchQuery.trim()}"`
                    : 'No transactions match your filter.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {csvOpen && <CSVImport onClose={() => setCsvOpen(false)} />}
      </AnimatePresence>
    </div>
  );
};
