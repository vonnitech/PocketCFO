import React, { useState, useMemo } from 'react';
import { Target, Zap, TrendingDown, Clock, ShieldAlert } from 'lucide-react';
import { useStore } from '../store/useStore';

interface Debt {
  id: string;
  name: string;
  balance: number;
  rate: number;
  minPay: number;
}

// Removed DEFAULT_DEBTS since we use state

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
    let totalPaid = 0;

    // Safety limit to avoid infinite loops
    while (currentDebts.some(d => d.currentBalance > 0) && months < 600) {
      months++;
      let extraThisMonth = extraAmmo;
      
      // 1. Apply interest and identify freed up min payments
      for (let debt of currentDebts) {
        if (debt.currentBalance > 0) {
          const interest = (debt.currentBalance * (debt.rate / 100)) / 12;
          totalInterest += interest;
          debt.currentBalance += interest;
        }
      }

      // 2. Apply minimum payments
      for (let debt of currentDebts) {
        if (debt.currentBalance > 0) {
          const payment = Math.min(debt.currentBalance, debt.minPay);
          debt.currentBalance -= payment;
          totalPaid += payment;
        } else {
          // If debt was already 0 or paid off before this step, its min payment becomes extra ammo
          // (Actually common "snowball" rule: freed up min payments are rolled into the next debt)
        }
      }

      // 3. Roll over payments (the "snowball" effect)
      // Freed payments from finished debts
      const freedPayments = currentDebts
        .filter(d => d.currentBalance <= 0)
        .reduce((sum, d) => sum + d.minPay, 0);
      
      let totalSurplus = extraThisMonth + freedPayments;

      // 4. Apply extra ammo to the "target" debt
      const target = currentDebts.find(d => d.currentBalance > 0);
      if (target) {
        const extraPayment = Math.min(target.currentBalance, totalSurplus);
        target.currentBalance -= extraPayment;
        totalPaid += extraPayment;
      }
    }

    return { months, totalInterest };
  };

  const snowball = useMemo(() => simulate(debts, 'snowball'), [debts, extraAmmo]);
  const avalanche = useMemo(() => simulate(debts, 'avalanche'), [debts, extraAmmo]);
  
  const interestSaved = snowball.totalInterest - avalanche.totalInterest;
  const timeDifference = snowball.months - avalanche.months;

  return (
    <div className="min-h-screen bg-base text-text-main flex flex-col pt-8 px-6 pb-20">
      
      {/* Header */}
      <div className="mb-8">
        <p className="text-text-muted text-xs tracking-widest uppercase mb-1 flex items-center gap-2">
          <Target size={14} /> Debt Destroyer
        </p>
        <div className="border-b-2 border-border pb-4">
          <h1 className="font-mono text-4xl text-text-main uppercase tracking-tighter">
            Eradication Strategy
          </h1>
        </div>
      </div>

      {/* The Ammo Slider */}
      <div className="mb-12 bg-surface border-2 border-border p-6 shadow-brutal">
        <div className="flex justify-between items-center mb-4">
          <label className="text-text-muted text-xs font-black tracking-widest uppercase">
            Extra Monthly Ammo
          </label>
          <span className="font-mono text-3xl text-action-capture">${extraAmmo}</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max="2000" 
          step="50" 
          value={extraAmmo}
          onChange={(e) => setExtraAmmo(parseInt(e.target.value))}
          className="w-full h-2 bg-border rounded-none appearance-none cursor-pointer accent-action-capture"
        />
        <p className="text-[10px] text-text-muted uppercase mt-4">
          Surplus capital applied to target debt after entry-level minimums.
        </p>
      </div>

      {/* Comparison Engine */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        
        {/* Snowball - Psychology */}
        <div className="border-2 border-border bg-surface p-6 opacity-70">
          <h2 className="font-mono text-text-main text-lg mb-4 flex items-center gap-2">
            <TrendingDown size={18} /> Snowball Method
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-text-muted uppercase text-[10px]">Interest Burned</p>
              <p className="font-mono text-2xl text-text-main">${snowball.totalInterest.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-text-muted uppercase text-[10px]">Time to Freedom</p>
              <p className="font-mono text-2xl text-text-main">
                {Math.floor(snowball.months / 12)}y {snowball.months % 12}m
              </p>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-border italic text-[10px] text-text-muted uppercase">
            Focuses on small wins. Mathematically inefficient.
          </div>
        </div>

        {/* Avalanche - The Math */}
        <div className="border-4 border-action-capture bg-surface p-6 shadow-brutal-green relative">
          <div className="absolute -top-3 left-4 bg-action-capture text-black px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
            Recommended Strategy
          </div>
          <h2 className="font-mono text-action-capture text-lg mb-4 flex items-center gap-2">
            <Zap size={18} /> Avalanche Strategy
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-text-muted uppercase text-[10px]">Interest Burned</p>
              <p className="font-mono text-2xl text-text-main">${avalanche.totalInterest.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-text-muted uppercase text-[10px]">Time to Freedom</p>
              <p className="font-mono text-2xl text-text-main">
                {Math.floor(avalanche.months / 12)}y {avalanche.months % 12}m
              </p>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-border text-[10px] text-action-capture uppercase font-bold">
            Maximum capital preservation. Targeted interest suppression.
          </div>
        </div>
      </div>

      {/* The Delta - Real Talk */}
      {interestSaved > 0 && (
        <div className="bg-action-capture/10 border-2 border-action-capture p-6 flex flex-col items-center justify-center text-center">
          <p className="text-action-capture uppercase text-xs font-black tracking-[0.3em] mb-2">
            The Math Dividend
          </p>
          <div className="flex items-center gap-4">
             <ShieldAlert className="text-action-capture" size={32} />
             <div className="text-left">
                <p className="text-3xl font-mono text-action-capture">
                  +${interestSaved.toFixed(2)}
                </p>
                <p className="text-text-muted text-[10px] uppercase">
                  Capital saved by choosing Avalanche over Snowball.
                </p>
             </div>
          </div>
          {timeDifference > 0 && (
            <p className="text-action-capture text-[10px] uppercase mt-4 font-bold">
              <Clock className="inline mr-1" size={10} /> You reach freedom {timeDifference} months faster with Avalanche.
            </p>
          )}
        </div>
      )}

    </div>
  );
};
