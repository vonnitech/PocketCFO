import Papa from 'papaparse';
import * as XLSX from 'xlsx';
// jspdf + jspdf-autotable are imported dynamically inside exportReportPDF so the
// PDF libraries (~250KB) stay out of the import/CSV/XLSX path and only load when
// someone actually generates a PDF.

import { Transaction, Subscription, Vault } from '../types';
import { Debt } from '../store/useStore';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface ExportSnapshot {
  firstName: string;
  liquidAssets: number;
  safeSpendLimit: number;
  upcomingBills: number;
  transactions: Transaction[];
  vaults: Vault[];
  debts: Debt[];
  subscriptions: Subscription[];
}

// ── CSV ──────────────────────────────────────────────────────────────────────

const INCOME_CATEGORIES   = new Set(['INCOME', 'VAULT_WITHDRAWAL']);
const TRANSFER_CATEGORIES = new Set(['VAULT_DEPOSIT', 'VAULT_TRANSFER', 'SAVINGS']);

function txType(category: string): 'Income' | 'Transfer' | 'Bill' | 'Spend' {
  if (INCOME_CATEGORIES.has(category))   return 'Income';
  if (TRANSFER_CATEGORIES.has(category)) return 'Transfer';
  if (category === 'BILL_PAYMENT' || category === 'DEBT_PAYMENT') return 'Bill';
  return 'Spend';
}

export function exportLedgerCSV(transactions: Transaction[]): void {
  const rows = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(t => ({
      Date:     fmtDate(t.date),
      Merchant: t.merchant,
      Category: t.category,
      Amount:   t.amount.toFixed(2),
      Type:     txType(t.category),
      Flip:     t.isFlip ? 'YES' : 'NO',
      Penalty:  (t.flipAmount || 0).toFixed(2),
    }));
  const csv = Papa.unparse(rows);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `pocket_cfo_ledger.csv`);
}

// ── Excel (multi-tab) ────────────────────────────────────────────────────────

export function exportWorkbookXLSX(snap: ExportSnapshot): void {
  const wb = XLSX.utils.book_new();

  const totalVaulted = snap.vaults.reduce((s, v) => s + (v.current || 0), 0);
  const totalDebt    = snap.debts.reduce((s, d) => s + (d.balance || 0), 0);
  const netWorth     = snap.liquidAssets + totalVaulted - totalDebt;

  // Summary tab
  const summaryRows: (string | number)[][] = [
    ['POCKET CFO · FINANCIAL SUMMARY'],
    ['Generated', new Date().toLocaleString()],
    ['User', snap.firstName || '—'],
    [],
    ['Net Worth', netWorth],
    ['Liquid Assets', snap.liquidAssets],
    ['Safe Spend Limit', snap.safeSpendLimit],
    ['Upcoming Bills', snap.upcomingBills],
    ['Total Vaulted', totalVaulted],
    ['Total Debt', totalDebt],
    [],
    ['VAULTS'],
    ['Name', 'Current', 'Target', '% Funded'],
    ...snap.vaults.map(v => [v.name, v.current || 0, v.target || 0, v.target ? Number(((v.current / v.target) * 100).toFixed(1)) : 0]),
    [],
    ['DEBTS'],
    ['Name', 'Balance', 'Interest Rate', 'Min Payment'],
    ...snap.debts.map(d => [d.name, d.balance || 0, d.interestRate || 0, d.minPayment || 0]),
    [],
    ['SUBSCRIPTIONS'],
    ['Name', 'Amount', 'Cycle', 'Usage'],
    ...snap.subscriptions.map(s => [s.name, s.amount || 0, s.billingCycle, s.usage]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Ledger tab
  const ledgerRows = [...snap.transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(t => ({
      Date:     fmtDate(t.date),
      Merchant: t.merchant,
      Category: t.category,
      Amount:   t.amount,
      Flip:     t.isFlip ? 'YES' : 'NO',
      Penalty:  t.flipAmount || 0,
    }));
  const ledgerSheet = XLSX.utils.json_to_sheet(ledgerRows);
  ledgerSheet['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 8 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ledgerSheet, 'Ledger');

  XLSX.writeFile(wb, `pocket_cfo_report.xlsx`);
}

// ── PDF ──────────────────────────────────────────────────────────────────────

export async function exportReportPDF(snap: ExportSnapshot): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  // 8.5 × 11 in @ 72pt/in → 612 × 792
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  const totalVaulted = snap.vaults.reduce((s, v) => s + (v.current || 0), 0);
  const totalDebt    = snap.debts.reduce((s, d) => s + (d.balance || 0), 0);
  const netWorth     = snap.liquidAssets + totalVaulted - totalDebt;

  // Brand block — thick black header bar, gold accent
  doc.setFillColor(17, 17, 17);
  doc.rect(margin, y, pageW - margin * 2, 56, 'F');
  doc.setFillColor(250, 204, 21); // action-primary
  doc.rect(margin, y, 10, 56, 'F');
  doc.setTextColor(250, 204, 21);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('POCKET CFO', margin + 24, y + 28);
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('FINANCIAL AUDIT', margin + 24, y + 46);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase(), pageW - margin - 8, y + 30, { align: 'right' });
  if (snap.firstName) {
    doc.text(`FOR: ${snap.firstName.toUpperCase()}`, pageW - margin - 8, y + 46, { align: 'right' });
  }
  y += 80;

  // Net Worth hero
  doc.setDrawColor(0);
  doc.setLineWidth(2);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, pageW - margin * 2, 60, 'FD');
  doc.setTextColor(0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('NET WORTH', margin + 12, y + 18);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtMoney(netWorth), margin + 12, y + 46);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(netWorth >= 0 ? 'POSITIVE' : 'NEGATIVE', pageW - margin - 12, y + 18, { align: 'right' });
  y += 76;

  // Balance cards — 3 per row
  const cards: { label: string; value: number }[] = [
    { label: 'LIQUID ASSETS',   value: snap.liquidAssets },
    { label: 'SAFE SPEND/DAY',  value: snap.safeSpendLimit },
    { label: 'UPCOMING BILLS',  value: snap.upcomingBills },
    { label: 'VAULTED',         value: totalVaulted },
    { label: 'DEBT',            value: totalDebt },
  ];
  const perRow = 3;
  const cardW = (pageW - margin * 2 - 8 * (perRow - 1)) / perRow;
  cards.forEach((c, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = margin + col * (cardW + 8);
    const cy = y + row * 56;
    doc.rect(x, cy, cardW, 48, 'D');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(c.label, x + 8, cy + 14);
    doc.setFontSize(13);
    doc.text(fmtMoney(c.value), x + 8, cy + 36);
  });
  y += Math.ceil(cards.length / perRow) * 56 + 8;

  // Vaults table
  if (snap.vaults.length > 0) {
    autoTable(doc, {
      head: [['Vault', 'Current', 'Target', '% Funded']],
      body: snap.vaults.map(v => [
        v.name,
        fmtMoney(v.current || 0),
        fmtMoney(v.target || 0),
        v.target ? `${((v.current / v.target) * 100).toFixed(1)}%` : '—',
      ]),
      startY: y,
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [17, 17, 17], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      theme: 'grid',
    });
    y = (doc as any).lastAutoTable.finalY + 20;
  }

  // Recent transactions (last 30 days)
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentTxs = snap.transactions
    .filter(t => new Date(t.date).getTime() >= cutoff)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (recentTxs.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('RECENT TRANSACTIONS · LAST 30 DAYS', margin, y);
    y += 12;
    autoTable(doc, {
      head: [['Date', 'Merchant', 'Category', 'Amount']],
      body: recentTxs.map(t => [
        fmtDate(t.date),
        t.merchant,
        t.category,
        fmtMoney(t.amount),
      ]),
      startY: y,
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [17, 17, 17], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      theme: 'grid',
    });
  }

  // Footer on every page
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(`Pocket CFO · Generated ${new Date().toLocaleString()}`, margin, doc.internal.pageSize.getHeight() - 16);
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin, doc.internal.pageSize.getHeight() - 16, { align: 'right' });
  }

  doc.save(`pocket_cfo_report.pdf`);
}

// ── Import parser (headers + rows for the column-mapping modal) ──────────────

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

export async function parseImportFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    return {
      headers,
      rows: rows.map(r => {
        const out: Record<string, string> = {};
        for (const k of headers) out[k] = String(r[k] ?? '');
        return out;
      }),
    };
  }
  // CSV
  const text = await file.text();
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  return {
    headers: (result.meta.fields || []).filter(Boolean) as string[],
    rows: (result.data || []).map(r => {
      const out: Record<string, string> = {};
      for (const k of Object.keys(r || {})) out[k] = String((r as any)[k] ?? '');
      return out;
    }),
  };
}

export interface ImportMapping {
  date: string;       // header name
  merchant: string;
  amount: string;
  category: string;   // optional header name — '' means use defaultCategory for every row
  reverseSigns: boolean;
  defaultCategory: string;
}

// Normalize a raw category value from any bank / app export to one of our buckets.
// Recognises common variants: "food", "Restaurants", "grocery", "transport", "uber", etc.
function normalizeCategory(raw: string, fallback: string): string {
  const norm = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (!norm) return fallback;

  // Direct match first (e.g. "FOOD" → "FOOD")
  const upper = raw.trim().toUpperCase();
  if (['FOOD','TRANSPORT','FUN','SHOPPING','HEALTH','HOME','WORK','OTHER','INCOME','SAVINGS'].includes(upper)) {
    return upper;
  }

  // Keyword groups → app category. Order matters: more specific buckets are
  // tested first so collisions (e.g. "Car insurance" matching both "car" and
  // "insurance") resolve to the right one. HOME patterns checked before AUTO/TRANSPORT
  // so "Home, Auto" → HOME instead of TRANSPORT.
  if (/food|restaurant|grocer|dining|cafe|coffee|takeout|delivery|meal/.test(norm)) return 'FOOD';
  if (/home|rent|mortgage|utilit|electric|water|internet|phone|insurance/.test(norm)) return 'HOME';
  if (/auto|vehicle|car|transport|uber|lyft|taxi|rideshare|ridesharing|gas|fuel|petrol|parking|transit|metro|bus|train|toll/.test(norm)) return 'TRANSPORT';
  if (/health|medical|pharmacy|doctor|dental|fitness|gym/.test(norm)) return 'HEALTH';
  if (/fun|entertainment|movie|game|hobby|concert|streaming|netflix|spotify|bar|alcohol/.test(norm)) return 'FUN';
  if (/shop|amazon|target|walmart|cloth|apparel|retail|electronic/.test(norm)) return 'SHOPPING';
  if (/work|business|office|tax|professional|saas|software/.test(norm)) return 'WORK';
  if (/income|salary|paycheck|payroll|deposit|refund|interest|dividend/.test(norm)) return 'INCOME';
  if (/saving|invest|vault|brokerage|retirement|ira|401k/.test(norm)) return 'SAVINGS';
  return fallback;
}

export function buildTransactionsFromMapping(parsed: ParsedFile, map: ImportMapping): Transaction[] {
  const out: Transaction[] = [];
  for (const row of parsed.rows) {
    const rawDate = (row[map.date] || '').trim();
    const merchant = (row[map.merchant] || '').trim();
    const rawAmount = (row[map.amount] || '').trim().replace(/[$€£,\s]/g, '');
    if (!rawDate && !merchant && !rawAmount) continue;
    let amount = parseFloat(rawAmount);
    if (isNaN(amount) || amount === 0) continue;  // Skip $0 rows (e.g. CC payment grouping artifacts)
    if (map.reverseSigns) amount = -amount;
    // We store spend as positive amounts. If sign is negative, it's a credit/income.
    const isIncome = amount < 0;
    const finalAmount = Math.abs(amount);
    const isoDate = (() => {
      if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) return rawDate.slice(0, 10);
      const m = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (m) {
        const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
        return `${yr}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
      }
      const d = new Date(rawDate);
      return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
    })();

    // Resolve category: income flag wins, then mapped column (normalized), then default.
    let resolvedCategory: string;
    if (isIncome) {
      resolvedCategory = 'INCOME';
    } else if (map.category) {
      resolvedCategory = normalizeCategory(row[map.category] || '', map.defaultCategory || 'OTHER');
    } else {
      resolvedCategory = map.defaultCategory || 'OTHER';
    }

    out.push({
      id:         crypto.randomUUID(),
      merchant:   merchant.toUpperCase() || 'IMPORTED',
      amount:     finalAmount,
      category:   resolvedCategory,
      date:       new Date(isoDate).toISOString(),
      isFlip:     false,
      flipAmount: 0,
    });
  }
  return out;
}

// ── Recurring detection ──────────────────────────────────────────────────────

export interface RecurringCandidate {
  key:         string;              // stable identifier for selection toggles
  merchant:    string;
  amount:      number;              // positive — sign is captured in `kind`
  dueDay:      number;              // 1-31, most common day of month
  kind:        'expense' | 'income';
  occurrences: number;
}

// Detects groups of transactions that look like monthly recurrings — same merchant,
// same amount, appearing 2+ times. Day-of-month is the median across occurrences.
export function detectRecurring(parsed: ParsedFile, map: ImportMapping): RecurringCandidate[] {
  if (!map.merchant || !map.amount || !map.date) return [];

  // Group rows: { merchant + |amount| → { sign, dayOfMonth[] } }
  const groups = new Map<string, { merchant: string; amount: number; isIncome: boolean; days: number[] }>();

  for (const row of parsed.rows) {
    const rawDate    = (row[map.date] || '').trim();
    const merchant   = (row[map.merchant] || '').trim();
    const rawAmount  = (row[map.amount] || '').trim().replace(/[$€£,\s]/g, '');
    if (!rawDate || !merchant || !rawAmount) continue;
    let amount = parseFloat(rawAmount);
    if (isNaN(amount) || amount === 0) continue;
    if (map.reverseSigns) amount = -amount;
    const isIncome = amount < 0;
    const absAmt = Math.abs(amount);

    // Skip clearly non-recurring transfer artifacts
    if (/payment.*transfer|credit card payment/i.test(merchant)) continue;

    // Parse day-of-month from the date
    let day = 0;
    if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) day = parseInt(rawDate.slice(8, 10), 10);
    else {
      const m = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-]/);
      if (m) day = parseInt(m[2], 10);
      else { const d = new Date(rawDate); if (!isNaN(d.getTime())) day = d.getDate(); }
    }
    if (day < 1 || day > 31) continue;

    const key = `${merchant.toUpperCase()}|${absAmt.toFixed(2)}`;
    const existing = groups.get(key);
    if (existing) existing.days.push(day);
    else groups.set(key, { merchant, amount: absAmt, isIncome, days: [day] });
  }

  const median = (xs: number[]): number => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  const candidates: RecurringCandidate[] = [];
  for (const [key, g] of groups.entries()) {
    if (g.days.length < 2) continue;  // Need at least 2 occurrences to call it recurring
    candidates.push({
      key,
      merchant: g.merchant,
      amount:   g.amount,
      dueDay:   median(g.days),
      kind:     g.isIncome ? 'income' : 'expense',
      occurrences: g.days.length,
    });
  }

  // Sort: expenses first (more actionable), then by occurrences desc
  return candidates.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'expense' ? -1 : 1;
    return b.occurrences - a.occurrences;
  });
}
