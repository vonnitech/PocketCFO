import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Upload, Trash2, AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../lib/utils';
import { CSVImport } from '../components/CSVImport';
import { ProAction } from '../components/ProAction';
import type { Transaction } from '../types';
import { toLocalDateKey, isCashInflow } from '../core/math';

const CATEGORY_META: Record<string, { label: string; bg: string; text: string }> = {
  FOOD:             { label: 'Food',       bg: 'bg-input',                text: 'text-text-muted' },
  TRANSPORT:        { label: 'Transport',  bg: 'bg-input',                text: 'text-text-muted' },
  FUN:              { label: 'Fun',        bg: 'bg-input',                text: 'text-text-muted' },
  SHOPPING:         { label: 'Shopping',   bg: 'bg-input',                text: 'text-text-muted' },
  HEALTH:           { label: 'Health',     bg: 'bg-input',                text: 'text-text-muted' },
  HOME:             { label: 'Home',       bg: 'bg-input',                text: 'text-text-muted' },
  WORK:             { label: 'Work',       bg: 'bg-input',                text: 'text-text-muted' },
  VAULT_DEPOSIT:    { label: 'Vaulted',    bg: 'bg-action-capture',       text: 'text-capture-contrast' },
  VAULT_WITHDRAWAL: { label: 'Withdrawal', bg: 'bg-action-bleed/20',      text: 'text-action-bleed' },
  VAULT_TRANSFER:   { label: 'Transfer',   bg: 'bg-input',                text: 'text-text-muted' },
  INCOME:           { label: 'Income',     bg: 'bg-action-primary',       text: 'text-primary-contrast' },
  SAVINGS:          { label: 'Savings',    bg: 'bg-action-capture',       text: 'text-capture-contrast' },
  DEBT_PAYMENT:     { label: 'Debt',       bg: 'bg-[#14b8a6]/20',         text: 'text-[#14b8a6]' },
  BILL_PAYMENT:     { label: 'Bill',       bg: 'bg-action-bleed/15',      text: 'text-action-bleed' },
  SUBSCRIPTION_PAYMENT: { label: 'Sub',    bg: 'bg-action-bleed/15',      text: 'text-action-bleed' },
  PENALTY:          { label: 'Penalty',    bg: 'bg-action-bleed/20',      text: 'text-action-bleed' },
  SOCIAL:           { label: 'Social',     bg: 'bg-[#facc15]/20',         text: 'text-[#facc15]' },
  PAYDAY:           { label: 'Payday',     bg: 'bg-action-primary',       text: 'text-primary-contrast' },
  OTHER:            { label: 'Spend',      bg: 'bg-input',                text: 'text-text-muted' },
};

const INCOME_CATEGORIES = new Set(['INCOME', 'VAULT_WITHDRAWAL']);

// Money that left the spending balance but was not spent. Shown with an arrow
// instead of a minus so putting cash aside does not read as losing it.
const TRANSFER_CATEGORIES = new Set(['SAVINGS', 'VAULT_DEPOSIT', 'VAULT_TRANSFER']);
const SPEND_FILTER_CATEGORIES = new Set(['FOOD', 'TRANSPORT', 'FUN', 'SHOPPING', 'HEALTH', 'HOME', 'WORK', 'OTHER', 'SOCIAL']);

const EDITABLE_CATEGORIES = [
  'FOOD', 'TRANSPORT', 'FUN', 'SHOPPING', 'HEALTH', 'HOME', 'WORK', 'OTHER',
  'INCOME', 'SAVINGS', 'BILL_PAYMENT', 'SUBSCRIPTION_PAYMENT', 'DEBT_PAYMENT',
];

const FILTER_TABS = [
  { id: 'ALL',              label: 'All' },
  { id: 'VAULT_DEPOSIT',    label: 'Vaulted' },
  { id: 'INCOME',           label: 'Income' },
  { id: 'SAVINGS',          label: 'Savings' },
  { id: 'DEBT_PAYMENT',     label: 'Debt' },
  { id: 'BILL_PAYMENT',     label: 'Bill' },
  { id: 'SUBSCRIPTION_PAYMENT', label: 'Sub' },
  { id: 'PENALTY',          label: 'Penalty' },
  { id: 'SPEND',            label: 'Spend' },
];

function formatDate(iso: string): string {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : toLocalDateKey(iso);
  const [year, month, day] = key.split('-').map(Number);
  const d = year && month && day ? new Date(year, month - 1, day) : new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function groupByDate(txs: ReturnType<typeof useStore.getState>['transactions']) {
  const map = new Map<string, typeof txs>();
  for (const tx of txs) {
    const key = toLocalDateKey(tx.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

export default function Ledger() {
  const transactions          = useStore(s => s.transactions);
  const privacyMode           = useStore(s => s.privacyMode);
  const allTransactionsLoaded = useStore(s => s.allTransactionsLoaded);
  const fetchMoreTransactions = useStore(s => s.fetchMoreTransactions);
  const deleteTransaction     = useStore(s => s.deleteTransaction);
  const updateTransaction     = useStore(s => s.updateTransaction);

  const [search,        setSearch]        = useState('');
  const [category,      setCategory]      = useState('ALL');
  const [importOpen,    setImportOpen]    = useState(false);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [editMode,      setEditMode]      = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [deleting,      setDeleting]      = useState(false);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try { await deleteTransaction(pendingDelete.id); }
    finally { setDeleting(false); setPendingDelete(null); }
  };

  // Infinite scroll — when the sentinel enters the viewport, fetch the next page.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (allTransactionsLoaded) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let cancelled = false;
    const observer = new IntersectionObserver(async (entries) => {
      if (!entries[0]?.isIntersecting) return;
      if (loadingMore || cancelled) return;
      setLoadingMore(true);
      try { await fetchMoreTransactions(); }
      finally { if (!cancelled) setLoadingMore(false); }
    }, { rootMargin: '300px 0px' });
    observer.observe(el);
    return () => { cancelled = true; observer.disconnect(); };
  }, [allTransactionsLoaded, fetchMoreTransactions, loadingMore, transactions.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter(tx => {
      if (category === 'SPEND') {
        if (!SPEND_FILTER_CATEGORIES.has(tx.category)) return false;
      } else if (category !== 'ALL' && tx.category !== category) {
        return false;
      }
      if (q && !tx.merchant.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [transactions, category, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const meta = (cat: string) => CATEGORY_META[cat] ?? CATEGORY_META.OTHER;
  const isCredit = (cat: string) => INCOME_CATEGORIES.has(cat);
  const isTransfer = (cat: string) => TRANSFER_CATEGORIES.has(cat);

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
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setEditMode(e => !e)}
            className={`flex items-center gap-1.5 h-10 px-3 border-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
              editMode
                ? 'bg-black text-action-primary border-black'
                : 'bg-surface text-text-muted border-border hover:border-black hover:text-text-main'
            }`}
          >
            {editMode ? <><X size={13} strokeWidth={3} /> Done</> : <><Trash2 size={13} strokeWidth={2.5} /> Edit</>}
          </button>
          <ProAction feature="import">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 h-10 px-4 bg-surface border-2 border-border rounded-2xl font-black text-[10px] uppercase tracking-widest text-text-muted hover:border-black hover:text-text-main transition-all shadow-[2px_2px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
            >
              <Upload size={13} strokeWidth={2.5} />
              Import
            </button>
          </ProAction>
        </div>
      </div>

      <AnimatePresence>
        {importOpen && <CSVImport onClose={() => setImportOpen(false)} />}
      </AnimatePresence>

      {/* Search */}
      <div className="relative">
        <Search size={14} strokeWidth={2.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search merchant…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-input border-4 border-black rounded-2xl pl-10 pr-10 py-3.5 font-bold text-sm text-text-main placeholder:text-text-muted outline-none focus:border-action-capture transition-colors uppercase tracking-wide"
        />
        {search && (
          <button
            type="button"
            title="Clear search"
            aria-label="Clear search"
            onClick={() => setSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Category filter chips */}
      {/* Fourth and final shape for this row. The three rejected options and
          why, so nobody cycles through them again:

            scroll + hidden scrollbar  four of nine filters invisible, and on a
                                       mouse they are unreachable: the wheel
                                       scrolls vertically, so only touch works.
            scroll + edge fade         same mouse problem. The fade advertises
                                       content the user still cannot reach.
            grid-cols-3                even rows, but pills stretch to fill a
                                       cell and stop reading as pills.

          Wrapping is the only option where nothing is hidden and nothing is
          stretched. The last row is ragged. That is cosmetic, and it is the
          cheapest of the four costs. */}
      <div className="flex flex-wrap gap-2">
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
              const transfer = isTransfer(tx.category);
              return (
                <div
                  key={tx.id}
                  className={`flex items-center gap-3 px-4 py-3.5 ${i < txs.length - 1 ? 'border-b-2 border-border' : ''}`}
                >
                  {/* Category chip — editable in edit mode */}
                  {editMode ? (
                    <select
                      title="Change category"
                      value={tx.category}
                      onChange={e => updateTransaction(tx.id, { category: e.target.value })}
                      className="shrink-0 h-6 px-1.5 rounded-full bg-input border-2 border-black text-[9px] font-black uppercase tracking-widest text-text-main outline-none cursor-pointer"
                    >
                      {EDITABLE_CATEGORIES.map(c => (
                        <option key={c} value={c}>{CATEGORY_META[c]?.label ?? c}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`shrink-0 inline-flex items-center h-6 px-2.5 rounded-full ${m.bg} ${m.text} text-[9px] font-black uppercase tracking-widest`}>
                      {m.label}
                    </span>
                  )}

                  {/* Merchant */}
                  <p className="flex-1 min-w-0 text-[11px] font-black uppercase tracking-wide text-text-main truncate">
                    {tx.merchant}
                  </p>

                  {/* Amount */}
                  <p className={`shrink-0 text-sm font-black tabular-nums ${credit || transfer ? 'text-capture-readable' : 'text-text-main'}`}>
                    {credit ? '+' : transfer ? '→ ' : '-'}{formatCurrency(tx.amount, privacyMode)}
                  </p>

                  {/* Delete — only in edit mode */}
                  {editMode && (
                    <button
                      type="button"
                      title="Delete transaction"
                      aria-label="Delete transaction"
                      onClick={() => setPendingDelete(tx)}
                      className="shrink-0 w-8 h-8 -mr-1 flex items-center justify-center text-action-bleed border-2 border-action-bleed/40 hover:bg-action-bleed hover:text-white hover:border-action-bleed rounded-lg transition-colors"
                    >
                      <Trash2 size={13} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Infinite-scroll sentinel + status */}
      <div ref={sentinelRef} className="h-8" />
      {!allTransactionsLoaded && (
        <p className="text-center text-[10px] font-black uppercase tracking-widest text-text-muted py-2">
          {loadingMore ? 'Loading older transactions…' : 'Scroll for more'}
        </p>
      )}
      {allTransactionsLoaded && transactions.length > 0 && (
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-text-muted py-2">
          End of history
        </p>
      )}

      {/* Delete confirmation */}
      <AnimatePresence>
        {pendingDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => !deleting && setPendingDelete(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-surface border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full pointer-events-auto overflow-hidden">
                <div className="px-5 py-4 border-b-4 border-black bg-action-bleed/10 flex items-center gap-2">
                  <AlertCircle size={16} strokeWidth={2.5} className="text-action-bleed shrink-0" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-action-bleed">Delete Transaction</p>
                </div>

                <div className="p-5 space-y-4">
                  <div className="bg-input border-2 border-border rounded-2xl px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                      {formatDate(pendingDelete.date)}
                      <span className="mx-1.5">·</span>{pendingDelete.category}
                    </p>
                    <p className="text-sm font-black uppercase tracking-wide text-text-main mt-1 truncate">
                      {pendingDelete.merchant}
                    </p>
                    <p className="text-lg font-black italic tabular-nums text-text-main mt-1">
                      {isCashInflow(pendingDelete.category) ? '+' : '-'}{formatCurrency(pendingDelete.amount, false)}
                    </p>
                  </div>

                  <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted leading-relaxed space-y-1.5">
                    <p>
                      Removing this record will <span className="text-text-main">{isCashInflow(pendingDelete.category) ? 'subtract' : 'add back'} {formatCurrency(pendingDelete.amount, false)}</span> {isCashInflow(pendingDelete.category) ? 'from' : 'to'} your cash balance.
                    </p>
                    {(pendingDelete.category === 'VAULT_DEPOSIT' || pendingDelete.category === 'DEBT_PAYMENT') && (
                      <p className="text-action-bleed">
                        Vault and debt balances are <span className="underline">not</span> auto-reversed. Fix them manually if needed.
                      </p>
                    )}
                    <p>This action cannot be undone.</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingDelete(null)}
                      disabled={deleting}
                      className="flex-1 h-11 border-4 border-black rounded-full bg-surface text-text-main font-black uppercase text-[11px] tracking-widest hover:bg-input transition-all disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmDelete}
                      disabled={deleting}
                      className="flex-1 h-11 border-4 border-action-bleed rounded-full bg-action-bleed text-white font-black uppercase text-[11px] tracking-widest hover:bg-action-bleed/90 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={12} strokeWidth={3} /> {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
