import { useState } from 'react';
import { Clock, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { useStore } from '../store/useStore';

function contrastText(hex?: string): string {
  if (!hex || hex.length < 7) return 'text-black';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.45 ? 'text-black' : 'text-white';
}

export default function Strategy() {
  const { privacyMode, makeDebtPayment, debts, themeColors } = useStore();
  const captureTxt = contrastText(themeColors?.secondary);

  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [extraPayment, setExtraPayment]     = useState(0);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const calcMonths = (balance: number, rate: number, payment: number) => {
    if (payment <= 0) return 999;
    const r = rate / 100 / 12;
    if (r === 0) return Math.ceil(balance / payment);
    const m = Math.log(payment / (payment - balance * r)) / Math.log(1 + r);
    return isFinite(m) ? Math.ceil(m) : 999;
  };

  const hasDebts          = debts.length > 0;
  const debt              = debts.find(d => d.id === selectedDebtId) ?? debts[0] ?? { name: '', balance: 0, interestRate: 0, minPayment: 1, id: '' };
  const baseMonths        = calcMonths(debt.balance, debt.interestRate, debt.minPayment);
  const acceleratedMonths = calcMonths(debt.balance, debt.interestRate, debt.minPayment + extraPayment);
  const timeSaved         = baseMonths - acceleratedMonths;

  const mask = (v: number) => privacyMode ? '••••••' : formatCurrency(v, false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Strategy</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Debt payoff simulations</p>
      </div>

      {/* Debt Time Saver */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-action-bleed border-2 border-black rounded-full text-white text-[10px] font-black tracking-widest uppercase">
          <Clock size={11} /> DEBT TIME SAVER
        </div>

        {!hasDebts ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="w-14 h-14 bg-action-capture border-4 border-black rounded-2xl flex items-center justify-center">
              <ShieldCheck size={28} strokeWidth={2.5} className="text-black" />
            </div>
            <div>
              <p className="font-black italic uppercase text-lg tracking-tighter text-text-main">No Debts Tracked</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1">Add debts in Settings to run simulations</p>
            </div>
          </div>
        ) : (
          <>
            {debts.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {debts.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDebtId(d.id)}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-[3px] rounded-full transition-all ${
                      debt.id === d.id
                        ? 'bg-action-bleed border-action-bleed text-white'
                        : 'border-black text-text-main opacity-50 hover:opacity-80'
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}

            <div className="bg-input border-4 border-black rounded-2xl p-4 flex justify-between items-center gap-3">
              <div className="w-9 h-9 bg-black flex items-center justify-center rounded-xl rotate-3 shrink-0">
                <Clock size={18} className="text-action-primary" />
              </div>
              <div className="text-right min-w-0 flex-1">
                <h3 className="font-black text-lg italic uppercase tracking-tighter text-text-main underline decoration-action-bleed truncate pr-1.5">{debt.name}</h3>
                <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted tabular-nums">
                  {mask(debt.balance)} @ {debt.interestRate}%
                </p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] mb-2">
                <span className="font-bold uppercase tracking-wide text-text-muted">Extra Monthly Payment</span>
                <span className="font-black uppercase tracking-widest text-capture-readable">+{mask(extraPayment)}</span>
              </div>
              <input
                type="range" min="0" max="1000" step="50"
                title="Extra Monthly Payment"
                value={extraPayment}
                onChange={e => setExtraPayment(parseInt(e.target.value))}
                className="w-full h-3 rounded-full appearance-none cursor-pointer accent-action-capture bg-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-input border-4 border-black rounded-2xl p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Months to Freedom</p>
                <p className="text-2xl font-black italic text-text-main">{acceleratedMonths} mos</p>
                {acceleratedMonths >= 24 && (
                  <p className="text-[11px] font-bold text-text-muted mt-0.5">{(acceleratedMonths / 12).toFixed(1)} yrs</p>
                )}
              </div>
              <div className="bg-action-capture border-4 border-black rounded-2xl p-4">
                <p className={`text-[11px] font-bold uppercase tracking-wide opacity-60 ${captureTxt}`}>Time Saved</p>
                <p className={`text-2xl font-black italic ${captureTxt}`}>{timeSaved} mos</p>
                {timeSaved >= 24 && (
                  <p className={`text-[11px] font-bold opacity-50 mt-0.5 ${captureTxt}`}>{(timeSaved / 12).toFixed(1)} yrs</p>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={extraPayment <= 0 || debt.balance <= 0}
              onClick={() => {
                if (extraPayment > 0 && debt.id) {
                  makeDebtPayment(debt.id, extraPayment);
                  setPaymentConfirmed(true);
                  setTimeout(() => { setPaymentConfirmed(false); setExtraPayment(0); }, 2000);
                }
              }}
              className="w-full h-14 border-4 border-black rounded-full bg-black text-action-primary font-black uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[4px_4px_0px_0px_var(--color-action-primary)]"
            >
              {paymentConfirmed ? '✓ PAYMENT LOGGED' : 'Confirm Payment'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
