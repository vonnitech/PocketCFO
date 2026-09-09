import React, { useMemo, useState } from 'react';
import { AlertTriangle, Clock, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import { currencySymbol } from '../lib/currency';

function contrastText(hex?: string): string {
  if (!hex || hex.length < 7) return 'text-black';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.45 ? 'text-black' : 'text-white';
}

export const SafetyNet: React.FC = () => {
  const { liquidAssets, fixedBills, themeColors } = useStore();
  const captureTxt = contrastText(themeColors?.secondary);
  const [liquidCapital, setLiquidCapital] = useState<number>(() => liquidAssets);
  const [baselineBurn, setBaselineBurn] = useState<number>(() => fixedBills);
  const [targetMonths, setTargetMonths] = useState<number>(6);

  const runwayMonths = useMemo(() => {
    if (baselineBurn <= 0) return Infinity;
    return liquidCapital / baselineBurn;
  }, [liquidCapital, baselineBurn]);

  // Target Cushion: the dollar buffer needed for `targetMonths` of burn, and the gap.
  const targetCapital = baselineBurn * targetMonths;
  const capitalDeficit = targetCapital - liquidCapital;

  const runwayStatus = runwayMonths < 3 ? 'critical' : runwayMonths < 6 ? 'warning' : 'safe';
  const runwayColor =
    runwayStatus === 'critical' ? 'bg-action-bleed' :
    runwayStatus === 'warning' ? 'bg-action-primary' :
    'bg-action-capture';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Safety Net</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Know exactly when you run out of cash</p>
      </div>

      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-action-bleed border-2 border-black rounded-full text-white text-[10px] font-black tracking-widest uppercase mb-4">
          <Clock size={11} /> SURVIVAL CLOCK
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
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
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted block mb-1.5">Monthly Spending</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-text-muted text-sm">{currencySymbol()}</span>
              <input
                type="number"
                title="Monthly Spending"
                value={baselineBurn}
                onFocus={e => e.target.select()}
                onChange={e => setBaselineBurn(Number(e.target.value))}
                className="w-full bg-input border-[3px] border-black rounded-xl p-3 pl-7 font-black text-text-main outline-none focus:border-action-bleed transition-colors"
              />
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted block mb-1.5">Target Cushion (Months)</label>
            <div className="relative">
              <input
                type="number"
                min="1"
                title="Target Cushion in Months"
                value={targetMonths}
                onFocus={e => e.target.select()}
                onChange={e => setTargetMonths(Number(e.target.value))}
                className="w-full bg-input border-[3px] border-black rounded-xl p-3 pr-10 font-black text-text-main outline-none focus:border-action-primary transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-black text-text-muted text-xs uppercase tracking-widest">mo</span>
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
                  <p className="text-[11px] font-black uppercase text-black/70 leading-tight text-right">BUILD<br />YOUR BUFFER</p>
                )}
                {runwayStatus === 'safe' && (
                  <p className={`text-[11px] font-black uppercase opacity-70 leading-tight text-right ${ctMuted}`}>SOLID<br />RESERVES</p>
                )}
              </div>
            </div>
          );
        })()}

        {/* The Big Reveal: cash gap vs your target cushion */}
        {baselineBurn > 0 && (
          capitalDeficit > 0 ? (
            <div className="mt-4 bg-action-bleed border-4 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-start gap-3">
              <AlertTriangle size={22} strokeWidth={3} className="text-white shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-1">Shortfall</p>
                <p className="text-sm font-black uppercase tracking-tight text-white leading-snug">
                  You need {currencySymbol()}{Math.round(capitalDeficit).toLocaleString()} more in cash to hit your {targetMonths}-month safety net.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 bg-action-capture border-4 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-start gap-3">
              <ShieldCheck size={22} strokeWidth={3} className={`shrink-0 mt-0.5 ${captureTxt}`} />
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest opacity-70 mb-1 ${captureTxt}`}>Locked In</p>
                <p className={`text-sm font-black uppercase tracking-tight leading-snug ${captureTxt}`}>
                  Your safety net is fully funded to your target.
                </p>
              </div>
            </div>
          )
        )}

        <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mt-3 text-center">
          Pre-filled from settings · edit to run scenarios
        </p>
      </div>
    </div>
  );
};
