import React, { useMemo, useState } from 'react';
import { AlertTriangle, Clock, Flame, TrendingUp, Zap } from 'lucide-react';
import { useStore } from '../store/useStore';
import { currencySymbol } from '../lib/currency';

function contrastText(hex?: string): string {
  if (!hex || hex.length < 7) return 'text-black';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.45 ? 'text-black' : 'text-white';
}

export const TacticalCommand: React.FC = () => {
  const { liquidAssets, fixedBills, themeColors } = useStore();
  const captureTxt = contrastText(themeColors?.secondary);
  const [liquidCapital, setLiquidCapital] = useState<number>(() => liquidAssets);
  const [baselineBurn, setBaselineBurn] = useState<number>(() => fixedBills);
  const [annualRaise, setAnnualRaise] = useState<number>(6000);
  const [redirectPercent, setRedirectPercent] = useState<number>(10);
  const [returnRate, setReturnRate] = useState<number>(7);
  const timeHorizonYears = 10;

  const runwayMonths = useMemo(() => {
    if (baselineBurn <= 0) return Infinity;
    return liquidCapital / baselineBurn;
  }, [liquidCapital, baselineBurn]);

  const leverMath = useMemo(() => {
    const annualVaulted = annualRaise * (redirectPercent / 100);
    const annualBurned = annualRaise - annualVaulted;
    const pmt = annualVaulted / 12;
    const r = (returnRate / 100) / 12;
    const n = timeHorizonYears * 12;
    const futureValue = pmt > 0 ? pmt * ((Math.pow(1 + r, n) - 1) / r) : 0;
    const totalContributed = annualVaulted * timeHorizonYears;
    const compoundGain = futureValue - totalContributed;
    const totalBurned = annualBurned * timeHorizonYears;
    return { annualVaulted, annualBurned, futureValue, totalBurned, totalContributed, compoundGain };
  }, [annualRaise, redirectPercent, returnRate]);

  const runwayStatus = runwayMonths < 3 ? 'critical' : runwayMonths < 6 ? 'warning' : 'safe';
  const runwayColor =
    runwayStatus === 'critical' ? 'bg-action-bleed' :
    runwayStatus === 'warning' ? 'bg-action-primary' :
    'bg-action-capture';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Savings Goals</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Financial lifeline & 10-year wealth builder</p>
      </div>

      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-action-bleed border-2 border-black rounded-full text-white text-[10px] font-black tracking-widest uppercase mb-4">
          <Clock size={11} /> SURVIVAL CLOCK
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted block mb-1.5">Cash Available</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-text-muted text-sm">{currencySymbol()}</span>
              <input
                type="number"
                title="Available Cash"
                value={liquidCapital}
                onFocus={e => e.target.select()}
                onChange={e => setLiquidCapital(Number(e.target.value))}
                className="w-full bg-input border-[3px] border-black rounded-xl p-3 pl-7 font-black text-text-main outline-none focus:border-action-capture transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted block mb-1.5">Monthly Burn</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-text-muted text-sm">{currencySymbol()}</span>
              <input
                type="number"
                title="Monthly Burn"
                value={baselineBurn}
                onFocus={e => e.target.select()}
                onChange={e => setBaselineBurn(Number(e.target.value))}
                className="w-full bg-input border-[3px] border-black rounded-xl p-3 pl-7 font-black text-text-main outline-none focus:border-action-bleed transition-colors"
              />
            </div>
          </div>
        </div>

        {(() => {
          const ct = runwayStatus === 'safe' ? captureTxt : 'text-black';
          const ctMuted = runwayStatus === 'safe' ? captureTxt : 'text-black';
          return (
            <div className={`${runwayColor} border-4 border-black rounded-2xl p-5 flex items-center justify-between`}>
              <div>
                <p className={`text-[11px] font-black uppercase tracking-widest opacity-60 mb-1 ${ct}`}>Runway</p>
                <div className="flex items-baseline gap-2">
                  <span className={`font-black text-5xl italic tabular-nums ${ct}`}>
                    {runwayMonths === Infinity ? '∞' : runwayMonths.toFixed(1)}
                  </span>
                  <span className={`opacity-60 font-black uppercase text-sm ${ct}`}>months</span>
                </div>
              </div>
              <div className="text-right">
                {runwayStatus === 'critical' && (
                  <div className="flex flex-col items-end gap-1">
                    <AlertTriangle size={20} className="text-text-main" strokeWidth={3} />
                    <p className="text-[11px] font-black uppercase text-black/70 leading-tight">CRITICAL<br />LOW</p>
                  </div>
                )}
                {runwayStatus === 'warning' && (
                  <p className="text-[11px] font-black uppercase text-black/70 leading-tight text-right">BELOW<br />6-MO TARGET</p>
                )}
                {runwayStatus === 'safe' && (
                  <p className={`text-[11px] font-black uppercase opacity-70 leading-tight text-right ${ctMuted}`}>SOLID<br />RESERVES</p>
                )}
              </div>
            </div>
          );
        })()}

        <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mt-3 text-center">
          Pre-filled from settings · edit to run scenarios
        </p>
      </div>

      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black border-2 border-action-primary rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase mb-4">
          <TrendingUp size={11} /> RAISE REDIRECTOR
        </div>

        <div className="space-y-4 mb-4">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Annual Raise</label>
              <span className="font-black text-text-main text-sm tabular-nums">${annualRaise.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="1000"
              max="50000"
              step="500"
              title="Expected Annual Raise"
              value={annualRaise}
              onChange={e => setAnnualRaise(Number(e.target.value))}
              className="w-full h-3 rounded-full appearance-none cursor-pointer accent-black bg-input"
            />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Vault Rate</label>
              <span className="font-black text-capture-readable text-sm">{redirectPercent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              title="Vault Rate"
              value={redirectPercent}
              onChange={e => setRedirectPercent(Number(e.target.value))}
              className="w-full h-3 rounded-full appearance-none cursor-pointer accent-action-capture bg-input"
            />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Expected Return</label>
              <span className="font-black text-action-primary text-sm">{returnRate}%/yr</span>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              step="0.5"
              title="Expected Annual Return"
              value={returnRate}
              onChange={e => setReturnRate(Number(e.target.value))}
              className="w-full h-3 rounded-full appearance-none cursor-pointer accent-action-primary bg-input"
            />
            <p className="text-[8px] font-bold uppercase tracking-wide text-text-muted mt-1.5">
              S&amp;P 500 avg ~10% · Bonds ~4% · Balanced ~7%
            </p>
          </div>
        </div>

        <div className="bg-input border-4 border-black rounded-2xl p-4 mb-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-2">Your raise splits into</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[8px] font-black uppercase text-capture-readable mb-0.5">Vaulted</p>
              <p className="text-xl font-black text-text-main">${leverMath.annualVaulted.toLocaleString()}<span className="text-sm text-text-muted">/yr</span></p>
            </div>
            <div className="text-lg font-black text-black/20">|</div>
            <div className="flex-1 text-right">
              <p className="text-[8px] font-black uppercase text-action-bleed mb-0.5">Spent</p>
              <p className="text-xl font-black text-text-main">${leverMath.annualBurned.toLocaleString()}<span className="text-sm text-text-muted">/yr</span></p>
            </div>
          </div>
        </div>

        <div className="bg-action-capture border-4 border-black rounded-2xl p-5 mb-3">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className={`text-[11px] font-black uppercase tracking-widest opacity-60 mb-1 ${captureTxt}`}>If you invest it - 10yr</p>
              <p className={`text-4xl font-black italic tabular-nums ${captureTxt}`}>
                {currencySymbol()}{leverMath.futureValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <Zap size={20} className={`opacity-30 mt-1 ${captureTxt}`} strokeWidth={3} />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-3 border-t-[3px] border-black/20">
            <div>
              <p className={`text-[8px] font-black uppercase opacity-50 mb-0.5 ${captureTxt}`}>You put in</p>
              <p className={`text-sm font-black ${captureTxt}`}>
                {currencySymbol()}{leverMath.totalContributed.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className={`text-[8px] font-black uppercase opacity-50 mb-0.5 ${captureTxt}`}>Market adds</p>
              <p className={`text-sm font-black ${captureTxt}`}>
                +{currencySymbol()}{leverMath.compoundGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-input border-4 border-black rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-0.5">If you spend it · 10yr</p>
            <p className="text-xl font-black italic text-action-bleed">
              -{currencySymbol()}{leverMath.totalBurned.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[8px] font-bold uppercase text-text-muted mt-1">Gone. Nothing to show for it.</p>
          </div>
          <Flame size={18} className="text-action-bleed/40" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
};


