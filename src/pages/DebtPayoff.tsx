import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Check, X, Wallet, ChevronDown, Flame } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../lib/utils';
import { currencySymbol } from '../lib/currency';
import { PreviewChip } from '../components/PreviewChip';
import { ProAction } from '../components/ProAction';

const DEBT_PALETTES = [
  { borderClass: '[border-left-color:#E8174B]', bgClass: 'bg-[#E8174B]', color: '#E8174B' },
  { borderClass: '[border-left-color:#F97316]', bgClass: 'bg-[#F97316]', color: '#F97316' },
  { borderClass: '[border-left-color:#F5C518]', bgClass: 'bg-[#F5C518]', color: '#F5C518' },
  { borderClass: '[border-left-color:#00C853]', bgClass: 'bg-[#00C853]', color: '#00C853' },
  { borderClass: '[border-left-color:#14b8a6]', bgClass: 'bg-[#14b8a6]', color: '#14b8a6' },
  { borderClass: '[border-left-color:#38bdf8]', bgClass: 'bg-[#38bdf8]', color: '#38bdf8' },
] as const;

interface Debt {
  id: string;
  name: string;
  balance: number;
  rate: number;
  minPay: number;
}

export const DebtPayoff: React.FC = () => {
  const { debts: storeDebts, liquidAssets, upcomingBills, makeDebtPayment } = useStore();
  const [extraAmmo, setExtraAmmo] = useState(200);
  const [whyOpen, setWhyOpen] = useState(false);

  // Pay-debt modal state
  const [payTarget, setPayTarget] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payPosting, setPayPosting] = useState(false);

  // Only the cash NOT already earmarked for upcoming bills is freely available
  // for an ad-hoc debt payment. Same rule we apply to the Fund Vault sheet.
  const availableForDebt = Math.max(0, liquidAssets - (upcomingBills || 0));

  const openPay = (debt: Debt) => {
    setPayTarget(debt);
    const suggested = Math.min(debt.minPay || 100, availableForDebt, debt.balance);
    setPayAmount(String(Math.max(0, Math.floor(suggested))));
  };
  const confirmPay = () => {
    if (!payTarget) return;
    const amt = parseFloat(payAmount) || 0;
    if (amt <= 0) return;
    const capped = Math.min(amt, payTarget.balance, availableForDebt);
    if (capped <= 0) return;
    setPayPosting(true);
    try {
      makeDebtPayment(payTarget.id, capped);
    } finally {
      setPayPosting(false);
      setPayTarget(null);
      setPayAmount('');
    }
  };

  const debts = useMemo(() => {
    return storeDebts.map((d: any) => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      rate: d.interestRate,
      minPay: d.minPayment,
    }));
  }, [storeDebts]);

  // We always run avalanche (highest-APR-first) — the mathematically optimal path.
  // No more strategy switcher: users get the right answer without having to learn jargon.
  const plan = useMemo(() => {
    if (debts.length === 0) return { months: 0, totalInterest: 0 };
    const queue = [...debts]
      .map(d => ({ ...d, currentBalance: d.balance }))
      .sort((a, b) => b.rate - a.rate);

    let months = 0;
    let totalInterest = 0;
    while (queue.some(d => d.currentBalance > 0) && months < 600) {
      months++;
      for (const d of queue) {
        if (d.currentBalance > 0) {
          const interest = (d.currentBalance * (d.rate / 100)) / 12;
          totalInterest += interest;
          d.currentBalance += interest;
        }
      }
      for (const d of queue) {
        if (d.currentBalance > 0) {
          d.currentBalance -= Math.min(d.currentBalance, d.minPay);
        }
      }
      const freedPayments = queue.filter(d => d.currentBalance <= 0).reduce((sum, d) => sum + d.minPay, 0);
      const totalSurplus = extraAmmo + freedPayments;
      const target = queue.find(d => d.currentBalance > 0);
      if (target) target.currentBalance -= Math.min(target.currentBalance, totalSurplus);
    }
    return { months, totalInterest };
  }, [debts, extraAmmo]);

  const payOffOrder = useMemo(() => [...debts].sort((a, b) => b.rate - a.rate), [debts]);
  const totalDebt   = useMemo(() => debts.reduce((s, d) => s + d.balance, 0), [debts]);
  const maxBalance  = Math.max(...payOffOrder.map(d => d.balance), 1);

  const yrs = Math.floor(plan.months / 12);
  const mos = plan.months % 12;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Debt Payoff</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
          Smart order · highest-cost debts first
        </p>
        <div className="mt-2"><PreviewChip /></div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface border-4 border-border rounded-3xl p-4 shadow-[4px_4px_0px_0px_var(--shadow-color)]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Total Debt</p>
          <p className="text-2xl font-black italic tracking-tighter text-text-main tabular-nums mt-1">
            {currencySymbol()}{totalDebt.toLocaleString()}
          </p>
        </div>
        <div className="bg-surface border-4 border-border rounded-3xl p-4 shadow-[4px_4px_0px_0px_var(--shadow-color)]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Months To Freedom</p>
          <p className="text-2xl font-black italic tracking-tighter text-text-main tabular-nums mt-1">
            {plan.months >= 600 ? '60y+' : (yrs > 0 ? `${yrs}y ${mos}m` : `${mos}m`)}
          </p>
        </div>
        <div className="bg-surface border-4 border-action-bleed rounded-3xl p-4 shadow-[4px_4px_0px_0px_var(--shadow-color)]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-action-bleed">Interest Cost</p>
          <p className="text-2xl font-black italic tracking-tighter text-action-bleed tabular-nums mt-1">
            {currencySymbol()}{Math.round(plan.totalInterest).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Extra Monthly Payment slider */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black border-2 border-action-primary rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase mb-4">
          EXTRA MONTHLY PAYMENT
        </div>
        <div className="flex justify-between items-center mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Surplus applied on top of minimums
          </p>
          <span className="text-3xl font-black italic text-capture-readable">${extraAmmo}</span>
        </div>
        <input
          type="range"
          title="Extra monthly payment"
          min="0"
          max="2000"
          step="50"
          value={extraAmmo}
          onChange={e => setExtraAmmo(parseInt(e.target.value))}
          className="w-full h-3 rounded-full appearance-none cursor-pointer accent-action-capture bg-input"
        />
      </div>

      {/* Pay-Off Order */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-action-bleed border-2 border-black rounded-full text-white text-[10px] font-black tracking-widest uppercase mb-4">
          <Flame size={11} strokeWidth={3} /> PAY-OFF ORDER
        </div>
        {payOffOrder.length === 0 ? (
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted text-center py-6">
            No debts added yet · go to Config to add them.
          </p>
        ) : (
          <div className="space-y-3">
            {payOffOrder.map((debt, i) => {
              const palette = DEBT_PALETTES[i % DEBT_PALETTES.length];
              const pct = (debt.balance / maxBalance) * 100;
              return (
                <div
                  key={debt.id}
                  className={`flex items-center gap-4 border-[3px] border-l-[5px] border-border rounded-2xl p-3 ${palette.borderClass}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white shrink-0 ${palette.bgClass}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="font-black uppercase text-sm tracking-tight text-text-main truncate">{debt.name}</span>
                      <span className="font-black text-sm tabular-nums text-text-main ml-2 shrink-0">${debt.balance.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-input rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%`, backgroundColor: palette.color }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-text-muted shrink-0">{debt.rate}% APR</span>
                    </div>
                  </div>
                  {i === 0 && (
                    <div className="shrink-0 px-2 py-0.5 bg-action-bleed text-white text-[11px] font-black uppercase tracking-widest rounded-full">
                      Next Up
                    </div>
                  )}
                  <ProAction feature="debt_mark_paid">
                    <button
                      type="button"
                      onClick={() => openPay(debt)}
                      disabled={availableForDebt <= 0 || debt.balance <= 0}
                      className="shrink-0 h-9 px-3 border-2 border-black rounded-full bg-black text-action-primary font-black uppercase text-[10px] tracking-widest hover:bg-action-primary hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Pay
                    </button>
                  </ProAction>
                </div>
              );
            })}
          </div>
        )}

        {/* Optional explainer — collapsed by default so the page stays calm. */}
        {payOffOrder.length > 0 && (
          <div className="mt-4 border-t-2 border-border/30 pt-3">
            <button
              type="button"
              onClick={() => setWhyOpen(o => !o)}
              className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
            >
              <span>Why this order?</span>
              <motion.div animate={{ rotate: whyOpen ? 180 : 0 }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}>
                <ChevronDown size={13} strokeWidth={2.5} />
              </motion.div>
            </button>
            <AnimatePresence initial={false}>
              {whyOpen && (
                <motion.p
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: 'auto', opacity: 1, marginTop: 8 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                  style={{ overflow: 'hidden' }}
                  className="text-[11px] font-bold uppercase tracking-wide text-text-muted leading-relaxed"
                >
                  Highest-interest debts get hit first — they cost you the most every month they exist.
                  Paying minimums on everything else keeps the lights on while your extra cash
                  goes to the worst offender.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Pay-debt modal */}
      <AnimatePresence>
        {payTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => !payPosting && setPayTarget(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-surface border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full pointer-events-auto overflow-hidden">
                <div className="px-5 py-4 border-b-4 border-black bg-input flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-action-bleed border-2 border-black rounded-full text-white text-[10px] font-black tracking-widest uppercase">
                    <Zap size={11} strokeWidth={3} /> Pay Down Debt
                  </div>
                  <button type="button" onClick={() => setPayTarget(null)} title="Close" aria-label="Close"
                    className="w-7 h-7 border-2 border-black rounded-lg flex items-center justify-center hover:bg-surface">
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="bg-input border-2 border-border rounded-2xl px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">{payTarget.rate}% APR</p>
                    <p className="text-sm font-black uppercase tracking-tight text-text-main mt-0.5 truncate">{payTarget.name}</p>
                    <p className="text-2xl font-black italic tabular-nums text-text-main mt-1">${payTarget.balance.toLocaleString()}</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">
                      Payment Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-text-muted/40 pointer-events-none">{currencySymbol()}</span>
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        title="Payment amount"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        onFocus={e => e.target.select()}
                        className="w-full bg-input border-4 border-black rounded-2xl pl-10 pr-4 py-3 font-black text-2xl text-text-main outline-none focus:border-action-capture tabular-nums"
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                      <span className="flex items-center gap-1"><Wallet size={11} strokeWidth={2.5} /> Available: {formatCurrency(availableForDebt)}</span>
                      {payTarget.minPay > 0 && <span>Min: {formatCurrency(payTarget.minPay)}</span>}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {[25, 50, 100].map(pct => {
                      const amt = Math.floor((availableForDebt * pct) / 100);
                      return (
                        <button key={pct} type="button" onClick={() => setPayAmount(String(amt))}
                          className="flex-1 h-9 border-2 border-border rounded-xl bg-input text-text-muted font-black text-[10px] uppercase tracking-widest hover:border-black hover:text-text-main transition-colors">
                          {pct}%
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPayTarget(null)} disabled={payPosting}
                      className="flex-1 h-12 border-4 border-black rounded-full bg-surface text-text-main font-black uppercase text-[11px] tracking-widest hover:bg-input transition-all disabled:opacity-40">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmPay}
                      disabled={payPosting || !payAmount || parseFloat(payAmount) <= 0 || availableForDebt <= 0}
                      className="flex-1 h-12 border-4 border-black rounded-full bg-action-capture text-capture-contrast font-black uppercase text-[11px] tracking-widest shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <Check size={13} strokeWidth={3} /> {payPosting ? 'Posting…' : 'Pay'}
                    </button>
                  </div>

                  <p className="text-[9px] font-bold uppercase tracking-wide text-text-muted/60 text-center">
                    Logs a DEBT_PAYMENT transaction and reduces your cash balance
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// Keep the named export used by the router. The default export keeps any HMR
// boundaries happy if this file is also imported as a default elsewhere.
export default DebtPayoff;
