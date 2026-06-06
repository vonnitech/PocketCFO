import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Zap, TrendingDown, Clock, ShieldAlert } from 'lucide-react';
import { useStore } from '../store/useStore';

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

interface SimulationResult {
  months: number;
  totalInterest: number;
}

export const DebtDestroyer: React.FC = () => {
  const { debts: storeDebts } = useStore();
  const [extraAmmo, setExtraAmmo] = useState(200);

  const debts = useMemo(() => {
    return storeDebts.map((d: any) => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      rate: d.interestRate,
      minPay: d.minPayment
    }));
  }, [storeDebts]);

  const simulate = (activeDebts: Debt[], strategy: 'snowball' | 'avalanche'): SimulationResult => {
    if (activeDebts.length === 0) return { months: 0, totalInterest: 0 };
    let currentDebts = activeDebts.map(d => ({ ...d, currentBalance: d.balance }));

    if (strategy === 'snowball') {
      currentDebts.sort((a, b) => a.balance - b.balance);
    } else {
      currentDebts.sort((a, b) => b.rate - a.rate);
    }

    let months = 0;
    let totalInterest = 0;

    while (currentDebts.some(d => d.currentBalance > 0) && months < 600) {
      months++;
      for (let debt of currentDebts) {
        if (debt.currentBalance > 0) {
          const interest = (debt.currentBalance * (debt.rate / 100)) / 12;
          totalInterest += interest;
          debt.currentBalance += interest;
        }
      }
      for (let debt of currentDebts) {
        if (debt.currentBalance > 0) {
          const payment = Math.min(debt.currentBalance, debt.minPay);
          debt.currentBalance -= payment;
        }
      }
      const freedPayments = currentDebts.filter(d => d.currentBalance <= 0).reduce((sum, d) => sum + d.minPay, 0);
      const totalSurplus = extraAmmo + freedPayments;
      const target = currentDebts.find(d => d.currentBalance > 0);
      if (target) {
        target.currentBalance -= Math.min(target.currentBalance, totalSurplus);
      }
    }

    return { months, totalInterest };
  };

  const snowball = useMemo(() => simulate(debts, 'snowball'), [debts, extraAmmo]);
  const avalanche = useMemo(() => simulate(debts, 'avalanche'), [debts, extraAmmo]);

  const interestSaved = snowball.totalInterest - avalanche.totalInterest;
  const timeDifference = snowball.months - avalanche.months;

  const attackOrder = useMemo(() => {
    return [...debts].sort((a, b) => b.rate - a.rate);
  }, [debts]);

  const maxBalance = Math.max(...attackOrder.map(d => d.balance), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Debt Free</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
          Eradication strategy · avalanche vs snowball
        </p>
      </div>

      {/* Extra Ammo Slider */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black border-2 border-action-primary rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase mb-4">
          EXTRA MONTHLY AMMO
        </div>
        <div className="flex justify-between items-center mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Surplus capital applied after minimums
          </p>
          <span className="text-3xl font-black italic text-capture-readable">${extraAmmo}</span>
        </div>
        <input
          type="range"
          title="Extra Monthly Ammo"
          min="0"
          max="2000"
          step="50"
          value={extraAmmo}
          onChange={e => setExtraAmmo(parseInt(e.target.value))}
          className="w-full h-3 rounded-full appearance-none cursor-pointer accent-action-capture bg-input"
        />
      </div>

      {/* Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Snowball */}
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] opacity-70">
          <div className="inline-flex items-center px-3 py-1 bg-input border-2 border-black rounded-full text-text-muted text-[10px] font-black tracking-widest uppercase mb-5">
            SNOWBALL METHOD
          </div>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-text-main flex items-center gap-2 mb-4">
            <TrendingDown size={20} strokeWidth={3} /> Snowball
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Interest Burned</p>
              <p className="text-2xl font-black italic text-text-main">${snowball.totalInterest.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Time to Freedom</p>
              <p className="text-2xl font-black italic text-text-main">
                {Math.floor(snowball.months / 12)}y {snowball.months % 12}m
              </p>
            </div>
          </div>
          <p className="mt-5 pt-4 border-t-2 border-border text-[10px] font-bold text-text-muted uppercase tracking-widest italic">
            Small wins first. Mathematically inefficient.
          </p>
        </div>

        {/* Avalanche - recommended */}
        <div className="bg-surface border-4 border-action-capture rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] relative">
          <div className="absolute -top-4 left-5 bg-action-capture text-capture-contrast px-3 py-1 text-[11px] font-black uppercase tracking-widest border-2 border-black rounded-full">
            Recommended
          </div>
          <div className="inline-flex items-center px-3 py-1 bg-action-capture border-2 border-black rounded-full text-capture-contrast text-[10px] font-black tracking-widest uppercase mb-5 mt-2">
            AVALANCHE STRATEGY
          </div>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-capture-readable flex items-center gap-2 mb-4">
            <Zap size={20} strokeWidth={3} /> Avalanche
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Interest Burned</p>
              <p className="text-2xl font-black italic text-text-main">${avalanche.totalInterest.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Time to Freedom</p>
              <p className="text-2xl font-black italic text-text-main">
                {Math.floor(avalanche.months / 12)}y {avalanche.months % 12}m
              </p>
            </div>
          </div>
          <p className="mt-5 pt-4 border-t-2 border-black/20 text-[10px] font-bold text-capture-readable uppercase tracking-widest">
            Maximum capital preservation. Targeted interest suppression.
          </p>
        </div>
      </div>

      {/* Attack Order */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-action-bleed border-2 border-black rounded-full text-white text-[10px] font-black tracking-widest uppercase mb-4">
          AVALANCHE ATTACK ORDER
        </div>
        {attackOrder.length === 0 ? (
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted text-center py-6">
            No debts added yet · go to Config to add them.
          </p>
        ) : (
          <div className="space-y-3">
            {attackOrder.map((debt, i) => {
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
                      ATTACK FIRST
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delta */}
      {interestSaved > 0 && (
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-action-capture border-2 border-black rounded-full text-capture-contrast text-[10px] font-black tracking-widest uppercase mb-4">
            THE MATH DIVIDEND
          </div>
          <div className="flex items-center gap-4">
            <ShieldAlert className="text-capture-readable shrink-0" size={36} strokeWidth={2.5} />
            <div className="min-w-0 flex-1">
              <p className="text-3xl sm:text-4xl font-black italic text-capture-readable tabular-nums">+${interestSaved.toFixed(2)}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1">
                Capital saved by choosing Avalanche over Snowball
              </p>
            </div>
          </div>
          {timeDifference > 0 && (
            <p className="text-capture-readable text-[10px] uppercase mt-4 font-bold flex items-center gap-1">
              <Clock size={12} /> You reach freedom {timeDifference} months faster with Avalanche.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
