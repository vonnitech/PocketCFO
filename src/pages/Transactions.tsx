import { useState, useMemo } from 'react';
import { Search, X, Upload } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../lib/utils';
import { CSVImport } from '../components/CSVImport';

const CATEGORY_META: Record<string, { label: string; bg: string; text: string }> = {
  VAULT_DEPOSIT:    { label: 'Vaulted',    bg: 'bg-action-capture',       text: 'text-black' },
  VAULT_WITHDRAWAL: { label: 'Withdrawal', bg: 'bg-action-bleed/20',      text: 'text-action-bleed' },
  VAULT_TRANSFER:   { label: 'Transfer',   bg: 'bg-input',                text: 'text-text-muted' },
  INCOME:           { label: 'Income',     bg: 'bg-action-primary',       text: 'text-black' },
  SAVINGS:          { label: 'Savings',    bg: 'bg-action-capture',       text: 'text-black' },
  DEBT_PAYMENT:     { label: 'Debt',       bg: 'bg-[#c084fc]/20',         text: 'text-[#c084fc]' },
  PENALTY:          { label: 'Penalty',    bg: 'bg-action-bleed/20',      text: 'text-action-bleed' },
  SOCIAL:           { label: 'Social',     bg: 'bg-[#facc15]/20',         text: 'text-[#facc15]' },
  PAYDAY:           { label: 'Payday',     bg: 'bg-action-primary',       text: 'text-black' },
  OTHER:            { label: 'Spend',      bg: 'bg-input',                text: 'text-text-muted' },
};

const INCOME_CATEGORIES = new Set(['INCOME', 'VAULT_WITHDRAWAL']);

const FILTER_TABS = [
  { id: 'ALL',              label: 'All' },
  { id: 'VAULT_DEPOSIT',    label: 'Vaulted' },
  { id: 'INCOME',           label: 'Income' },
  { id: 'SAVINGS',          label: 'Savings' },
  { id: 'DEBT_PAYMENT',     label: 'Debt' },
  { id: 'PENALTY',          label: 'Penalty' },
  { id: 'OTHER',            label: 'Spend' },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function groupByDate(txs: ReturnType<typeof useStore.getState>['transactions']) {
  const map = new Map<string, typeof txs>();
  for (const tx of txs) {
    const key = tx.date.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

export default function Transactions() {
  const transactions = useStore(s => s.transactions);
  const privacyMode  = useStore(s => s.privacyMode);

  const [search,        setSearch]        = useState('');
  const [category,      setCategory]      = useState('ALL');
  const [importOpen,    setImportOpen]    = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter(tx => {
      if (category !== 'ALL' && tx.category !== category) return false;
      if (q && !tx.merchant.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [transactions, category, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const meta = (cat: string) => CATEGORY_META[cat] ?? CATEGORY_META.OTHER;
  const isCredit = (cat: string) => INCOME_CATEGORIES.has(cat);

  return (
    <div className="space-y-5 pb-32 md:pb-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Ledger</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
            {transactions.length} transactions on record
          </p>
        </div>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="shrink-0 flex items-center gap-2 h-10 px-4 bg-surface border-2 border-border rounded-2xl font-black text-[10px] uppercase tracking-widest text-text-muted hover:border-black hover:text-text-main transition-all shadow-[2px_2px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
        >
          <Upload size={13} strokeWidth={2.5} />
          Import
        </button>
      </div>

      <AnimatePresence>
        {importOpen && <CSVImport onClose={() => setImportOpen(false)} />}
      </AnimatePresence>

      {/* Search */}
      <div className="relative">
        <Search size={14} strokeWidth={2.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search merchant..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-input border-4 border-black rounded-2xl pl-10 pr-10 py-3.5 font-bold text-sm text-text-main placeholder:text-text-muted/50 outline-none focus:border-action-capture transition-colors uppercase tracking-wide"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCategory(tab.id)}
            className={`shrink-0 h-8 px-4 rounded-full border-2 font-black text-[10px] uppercase tracking-widest transition-all ${
              category === tab.id
                ? 'bg-black border-black text-action-primary shadow-[2px_2px_0px_0px_var(--color-action-primary)]'
                : 'bg-input border-border text-text-muted hover:border-black hover:text-text-main'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {grouped.length === 0 && (
        <div className="bg-surface border-4 border-border rounded-3xl p-10 flex flex-col items-center gap-3 text-center">
          <p className="text-xl font-black italic uppercase text-text-main">No Transactions</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            {search || category !== 'ALL' ? 'Try adjusting your filters' : 'Start logging spend to see your ledger'}
          </p>
        </div>
      )}

      {/* Grouped transaction list */}
      {grouped.map(([dateKey, txs]) => (
        <div key={dateKey} className="space-y-2">

          {/* Date header */}
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted shrink-0">
              {formatDate(dateKey)}
            </p>
            <div className="flex-1 h-px bg-border" />
            <p className="text-[10px] font-black tabular-nums text-text-muted shrink-0">
              {formatCurrency(txs.reduce((s, t) => s + t.amount, 0), privacyMode)}
            </p>
          </div>

          {/* Rows */}
          <div className="bg-surface border-4 border-border rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_var(--shadow-color)]">
            {txs.map((tx, i) => {
              const m = meta(tx.category);
              const credit = isCredit(tx.category);
              return (
                <div
                  key={tx.id}
                  className={`flex items-center gap-3 px-4 py-3.5 ${i < txs.length - 1 ? 'border-b-2 border-border' : ''}`}
                >
                  {/* Category chip */}
                  <span className={`shrink-0 inline-flex items-center h-6 px-2.5 rounded-full ${m.bg} ${m.text} text-[9px] font-black uppercase tracking-widest`}>
                    {m.label}
                  </span>

                  {/* Merchant */}
                  <p className="flex-1 min-w-0 text-[11px] font-black uppercase tracking-wide text-text-main truncate">
                    {tx.merchant}
                  </p>

                  {/* Amount */}
                  <p className={`shrink-0 text-sm font-black tabular-nums ${credit ? 'text-action-primary' : 'text-text-main'}`}>
                    {credit ? '+' : '-'}{formatCurrency(tx.amount, privacyMode)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
