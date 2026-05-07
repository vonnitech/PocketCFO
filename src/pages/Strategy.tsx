import { useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Zap } from 'lucide-react';
import BrutalCard from '../components/BrutalCard';
import { formatCurrency } from '../lib/utils';
import { useStore } from '../store/useStore';

import { calculateSalaryDelta, calculate10YearCompoundCapture } from '../core/math';

export default function Strategy() {
  const state = useStore();
  const { ghostMode } = state;

  const [extraPayment, setExtraPayment] = useState(0);
  
  // Salary Negotiator State
  const [currentSalary, setCurrentSalary] = useState(state.salary.current);
  const [targetSalary, setTargetSalary] = useState(state.salary.target);

  const calculateDebtFreedom = (balance: number, rate: number, payment: number) => {
    const monthlyRate = rate / 100 / 12;
    if (monthlyRate === 0) return Math.ceil(balance / payment);
    const months = Math.log(payment / (payment - balance * monthlyRate)) / Math.log(1 + monthlyRate);
    return isFinite(months) ? Math.ceil(months) : 999;
  };

  const debt = state.debts[0] || { name: 'NO DEBT', balance: 0, interestRate: 0, minPayment: 1 };
  const baseMonths = calculateDebtFreedom(debt.balance, debt.interestRate, debt.minPayment);
  const acceleratedMonths = calculateDebtFreedom(debt.balance, debt.interestRate, debt.minPayment + extraPayment);
  const timeSaved = baseMonths - acceleratedMonths;

  const deltaSalary = calculateSalaryDelta(currentSalary, targetSalary);
  const tenYearsCompound = calculate10YearCompoundCapture(deltaSalary);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <header>
        <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase text-action-target">Growth Strategy</h1>
        <p className="text-text-muted font-mono mt-2 uppercase tracking-widest text-[10px]">Wealth Building Strategies</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Debt Time-Travel Engine */}
        <div className="space-y-6">
          <BrutalCard title="Debt Time Saver" color="bg-surface">
            <div className="space-y-6 text-text-main">
              <div className="flex justify-between items-center bg-base p-4 rounded-2xl border-4 border-border">
                <div className="bg-text-main text-base p-3 rotate-3">
                  <Clock size={24} />
                </div>
                <div className="text-right">
                  <h3 className="font-black text-xl italic uppercase underline decoration-action-bleed">{debt.name}</h3>
                  <p className="font-mono text-[10px] text-text-muted font-bold uppercase">{formatCurrency(debt.balance, ghostMode)} @ {debt.interestRate}%</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] font-mono font-black uppercase mb-2">
                    <span>Snowball Ammo (Extra Cash)</span>
                    <span className="text-action-capture">+{formatCurrency(extraPayment, ghostMode)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1000" 
                    step="50"
                    value={extraPayment}
                    onChange={(e) => setExtraPayment(parseInt(e.target.value))}
                    className="w-full h-8 accent-action-capture bg-border rounded-full cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border-4 border-border bg-surface rounded-3xl text-text-main">
                    <p className="text-[8px] font-mono font-black text-text-muted uppercase">Months to Freedom</p>
                    <p className="text-2xl font-black italic tracking-tight">{acceleratedMonths} MOS</p>
                  </div>
                  <div className="p-4 border-4 border-border bg-action-capture rounded-3xl text-base">
                    <p className="text-[8px] font-mono font-black text-base uppercase">Time Saved</p>
                    <p className="text-2xl font-black italic tracking-tight">{timeSaved} MOS</p>
                  </div>
                </div>
              </div>

              <button className="w-full py-4 bg-text-main text-base font-black italic uppercase tracking-widest border-4 border-border transition-all hover:bg-action-target hover:text-text-main rounded-xl">Confirm Payment</button>
            </div>
          </BrutalCard>
        </div>

        {/* Salary Negotiator */}
        <div className="space-y-6">
          <BrutalCard title="Salary Planner" color="bg-action-target text-black">
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] font-mono font-black uppercase mb-1">
                    <span className="text-black">Current Salary</span>
                    <span>{formatCurrency(currentSalary, ghostMode)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="30000" 
                    max="500000" 
                    step="5000"
                    value={currentSalary}
                    onChange={(e) => setCurrentSalary(parseInt(e.target.value))}
                    className="w-full h-8 accent-black bg-black/10 rounded-full cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-mono font-black uppercase mb-1">
                    <span className="text-black">Target Salary</span>
                    <span>{formatCurrency(targetSalary, ghostMode)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="30000" 
                    max="500000" 
                    step="5000"
                    value={targetSalary}
                    onChange={(e) => setTargetSalary(parseInt(e.target.value))}
                    className="w-full h-8 accent-black bg-black/10 rounded-full cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-6 bg-black text-white border-4 border-action-capture shadow-[8px_8px_0px_0px_rgba(0,255,65,0.2)] rounded-3xl transform -rotate-1">
                <p className="text-[10px] font-mono font-black uppercase opacity-70 italic">10-Year Growth Projection</p>
                <motion.p 
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-4xl md:text-5xl font-black text-action-capture mt-2 font-mono italic tracking-tighter"
                >
                  +{formatCurrency(tenYearsCompound, ghostMode)}
                </motion.p>
                <div className="mt-6 flex items-center justify-between border-t border-white/20 pt-4">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-mono uppercase text-gray-400">Monthly Surplus</span>
                    <span className="font-black text-action-target italic">+{formatCurrency(deltaSalary / 12, ghostMode)}</span>
                  </div>
                  <Zap className="text-action-capture" size={24} />
                  <div className="flex flex-col text-right">
                    <span className="text-[8px] font-mono uppercase text-gray-400">Salary Difference</span>
                    <span className="font-black text-white italic">{formatCurrency(deltaSalary, ghostMode)}</span>
                  </div>
                </div>
              </div>
              
              <p className="text-[10px] font-mono text-black font-black italic leading-tight uppercase opacity-60">
                * Summary: A 20% savings rate on this raise will significantly boost your wealth. Start planning your next steps.
              </p>
            </div>
          </BrutalCard>
        </div>
      </div>
    </div>
  );
}
