import React, { useState, useMemo } from 'react';
import { Clock, TrendingUp, AlertTriangle } from 'lucide-react';

export const TacticalCommand: React.FC = () => {
  // --- STATE: Survival Clock ---
  const [liquidCapital, setLiquidCapital] = useState<number>(12000);
  const [baselineBurn, setBaselineBurn] = useState<number>(4500);

  // --- STATE: The Lever ---
  const [annualRaise, setAnnualRaise] = useState<number>(6000);
  const [redirectPercent, setRedirectPercent] = useState<number>(10);
  const timeHorizonYears = 10; // Fixed for 10-year projection
  const expectedReturnRate = 0.07; // 7% market return

  // --- MATH ENGINE ---
  const runwayMonths = useMemo(() => {
    if (baselineBurn <= 0) return 0;
    return liquidCapital / baselineBurn;
  }, [liquidCapital, baselineBurn]);

  const leverMath = useMemo(() => {
    const annualVaulted = annualRaise * (redirectPercent / 100);
    const annualBurned = annualRaise - annualVaulted;
    
    // Future Value of a Series (Compound Interest)
    // FV = P * [ ( (1 + r)^n - 1 ) / r ]
    const futureValue = annualVaulted * ( (Math.pow(1 + expectedReturnRate, timeHorizonYears) - 1) / expectedReturnRate );
    
    // Total capital burned over 10 years
    const totalBurned = annualBurned * timeHorizonYears;

    return { annualVaulted, annualBurned, futureValue, totalBurned };
  }, [annualRaise, redirectPercent]);

  // --- UI STATUS RENDERERS ---
  const getRunwayStatusColor = (months: number) => {
    if (months < 3) return 'text-action-bleed border-action-bleed';
    if (months < 6) return 'text-action-target border-action-target';
    return 'text-action-capture border-action-capture';
  };

  return (
    <div className="min-h-screen bg-base flex flex-col pt-8 px-6 pb-20 space-y-12">
      
      {/* =========================================
          MODULE 1: THE SURVIVAL CLOCK (DEFENSE)
          ========================================= */}
      <section className="border-2 border-border bg-surface p-6 shadow-brutal">
        <h2 className="text-text-muted text-xs tracking-widest uppercase mb-6 flex items-center gap-2">
          <Clock size={16} /> Financial Lifeline
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div>
            <label className="text-[10px] text-text-muted uppercase tracking-widest block mb-1">Available Cash ($)</label>
            <input 
              type="number" 
              value={liquidCapital} 
              onChange={(e) => setLiquidCapital(Number(e.target.value))}
              className="w-full bg-base border-2 border-border text-text-main font-mono p-3 focus:outline-none focus:border-text-main transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted uppercase tracking-widest block mb-1">Monthly Expenses ($)</label>
            <input 
              type="number" 
              value={baselineBurn} 
              onChange={(e) => setBaselineBurn(Number(e.target.value))}
              className="w-full bg-base border-2 border-border text-text-main font-mono p-3 focus:outline-none focus:border-text-main transition-colors"
            />
          </div>
        </div>

        <div className={`p-6 border-l-4 ${getRunwayStatusColor(runwayMonths)} bg-base flex flex-col justify-center items-center`}>
          <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Financial Runway</p>
          <div className="flex items-baseline gap-2">
            <span className={`font-mono text-7xl font-bold ${getRunwayStatusColor(runwayMonths).split(' ')[0]}`}>
              {runwayMonths.toFixed(1)}
            </span>
            <span className="text-text-muted font-mono lowercase">months</span>
          </div>
          {runwayMonths < 3 && (
            <p className="mt-4 text-[10px] text-action-bleed uppercase tracking-widest flex items-center gap-1 font-bold">
              <AlertTriangle size={12} /> WARNING: LOW RESERVES
            </p>
          )}
        </div>
      </section>

      {/* =========================================
          MODULE 2: THE 1% LEVER (OFFENSE)
          ========================================= */}
      <section className="border-2 border-border bg-surface p-6 shadow-brutal">
        <h2 className="text-text-muted text-xs tracking-widest uppercase mb-6 flex items-center gap-2">
          <TrendingUp size={16} /> Wealth Builder (10-Year Projection)
        </h2>

        <div className="space-y-6 mb-8">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-[10px] text-text-muted uppercase tracking-widest block">Expected Annual Raise</label>
              <span className="font-mono text-text-main">${annualRaise}</span>
            </div>
            <input 
              type="range" min="1000" max="50000" step="500"
              value={annualRaise} 
              onChange={(e) => setAnnualRaise(Number(e.target.value))}
              className="w-full accent-text-main"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-[10px] text-text-muted uppercase tracking-widest block">Savings Rate (%)</label>
              <span className="font-mono text-action-capture">{redirectPercent}%</span>
            </div>
            <input 
              type="range" min="0" max="100" step="1"
              value={redirectPercent} 
              onChange={(e) => setRedirectPercent(Number(e.target.value))}
              className="w-full accent-action-capture"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border-2 border-action-capture bg-action-capture/5">
            <p className="text-action-capture text-[10px] uppercase tracking-widest mb-1">10-Year Growth</p>
            <p className="font-mono text-3xl text-action-capture">+${leverMath.futureValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            <p className="text-text-muted text-[10px] mt-2 flex justify-between">
              <span>Saved:</span>
              <span className="font-mono">${leverMath.annualVaulted}/yr</span>
            </p>
          </div>

          <div className="p-4 border-2 border-border bg-base">
            <p className="text-text-muted text-[10px] uppercase tracking-widest mb-1">Total Lifestyle Cost (10-Yr)</p>
            <p className="font-mono text-3xl text-action-bleed">-${leverMath.totalBurned.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            <p className="text-text-muted text-[10px] mt-2 flex justify-between">
              <span>Additional Spending:</span>
              <span className="font-mono">${leverMath.annualBurned}/yr</span>
            </p>
          </div>
        </div>

      </section>

    </div>
  );
};
