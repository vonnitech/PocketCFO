import { useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Zap, TrendingUp, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { useStore } from '../store/useStore';
import { calculateSalaryDelta, calculate10YearCompoundCapture } from '../core/math';

export default function Strategy() {
  const state = useStore();
  const { privacyMode, makeDebtPayment } = state;
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [extraPayment, setExtraPayment] = useState(0);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [currentSalary, setCurrentSalary] = useState(Math.max(state.salary.current, 30000));
  const [targetSalary, setTargetSalary] = useState(Math.max(state.salary.target, state.salary.current, 30000));

  const calculateDebtFreedom = (balance: number, rate: number, payment: number) => {
    const monthlyRate = rate / 100 / 12;
    if (monthlyRate === 0) return Math.ceil(balance / payment);
    const months = Math.log(payment / (payment - balance * monthlyRate)) / Math.log(1 + monthlyRate);
    return isFinite(months) ? Math.ceil(months) : 999;
  };

  const hasDebts = state.debts.length > 0;
  const debt = state.debts.find(d => d.id === selectedDebtId) || state.debts[0] || { name: '', balance: 0, interestRate: 0, minPayment: 1, id: '' };
  const baseMonths = calculateDebtFreedom(debt.balance, debt.interestRate, debt.minPayment);
  const acceleratedMonths = calculateDebtFreedom(debt.balance, debt.interestRate, debt.minPayment + extraPayment);
  const timeSaved = baseMonths - acceleratedMonths;

  const deltaSalary = calculateSalaryDelta(currentSalary, targetSalary);
  const tenYearsCompound = calculate10YearCompoundCapture(deltaSalary);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Planner</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Debt time-travel & salary growth</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              {state.debts.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {state.debts.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDebtId(d.id)}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-[3px] rounded-full transition-all ${
                        debt.id === d.id ? 'bg-action-bleed border-action-bleed text-white' : 'border-black text-text-main opacity-50 hover:opacity-80'
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
                  <h3 className="font-black text-lg italic uppercase tracking-tighter text-text-main underline decoration-action-bleed truncate">{debt.name}</h3>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted tabular-nums">{formatCurrency(debt.balance, privacyMode)} @ {debt.interestRate}%</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] mb-2">
                  <span className="font-bold uppercase tracking-wide text-text-muted">Extra Monthly Payment</span>
                  <span className="font-black uppercase tracking-widest text-action-capture">+{formatCurrency(extraPayment, privacyMode)}</span>
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
                  <p className="text-[11px] font-bold uppercase tracking-wide text-black/60">Time Saved</p>
                  <p className="text-2xl font-black italic text-black">{timeSaved} mos</p>
                  {timeSaved >= 24 && (
                    <p className="text-[11px] font-bold text-black/50 mt-0.5">{(timeSaved / 12).toFixed(1)} yrs</p>
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
                    setTimeout(() => {
                      setPaymentConfirmed(false);
                      setExtraPayment(0);
                    }, 2000);
                  }
                }}
                className="w-full h-14 border-4 border-black rounded-full bg-black text-action-primary font-black uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[4px_4px_0px_0px_var(--color-action-primary)]"
              >
                {paymentConfirmed ? '✓ PAYMENT LOGGED' : 'Confirm Payment'}
              </button>
            </>
          )}
        </div>

        {/* Salary Planner */}
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-action-primary border-2 border-black rounded-full text-black text-[10px] font-black tracking-widest uppercase">
            <TrendingUp size={11} /> SALARY PLANNER
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Current Salary</span>
                <span className="font-black text-sm text-text-main tabular-nums">{formatCurrency(currentSalary, privacyMode)}</span>
              </div>
              <input
                type="range" min="30000" max="500000" step="5000"
                title="Current Salary"
                value={currentSalary}
                onChange={e => setCurrentSalary(parseInt(e.target.value))}
                className="w-full h-3 rounded-full appearance-none cursor-pointer accent-black bg-input"
              />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Target Salary</span>
                <span className="font-black text-sm text-action-capture tabular-nums">{formatCurrency(targetSalary, privacyMode)}</span>
              </div>
              <input
                type="range" min="30000" max="500000" step="5000"
                title="Target Salary"
                value={targetSalary}
                onChange={e => setTargetSalary(parseInt(e.target.value))}
                className="w-full h-3 rounded-full appearance-none cursor-pointer accent-action-capture bg-input"
              />
            </div>
          </div>

          <div className="bg-black border-4 border-black rounded-3xl p-5 sm:-rotate-1 overflow-hidden">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/40 mb-1">10-Year Growth Projection</p>
            <motion.p
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-3xl sm:text-4xl font-black italic text-action-capture tabular-nums"
            >
              +{formatCurrency(tenYearsCompound, privacyMode)}
            </motion.p>
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
              <div>
                <span className="text-[11px] font-bold uppercase text-white/40">Monthly Surplus</span>
                <div className="font-black text-action-primary italic">+{formatCurrency(deltaSalary / 12, privacyMode)}</div>
              </div>
              <Zap className="text-action-capture opacity-40" size={18} />
              <div className="text-right">
                <span className="text-[11px] font-bold uppercase text-white/40">Annual Difference</span>
                <div className="font-black text-white italic">{formatCurrency(deltaSalary, privacyMode)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

