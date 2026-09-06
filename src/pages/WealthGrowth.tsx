import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, AlertOctagon, RotateCcw } from 'lucide-react';
import { currencySymbol } from '../lib/currency';

export const WealthGrowth: React.FC = () => {
  const [principal, setPrincipal] = useState('');
  const [monthly, setMonthly] = useState('');
  const [annualReturn, setAnnualReturn] = useState('');
  const [years, setYears] = useState('');

  const sanitize = (val: string) => val.replace(/[^0-9.]/g, '');
  const sanitizeInt = (val: string) => val.replace(/[^0-9]/g, '');

  const metrics = useMemo(() => {
    const P = parseFloat(principal) || 0;
    const PMT = parseFloat(monthly) || 0;
    const rate = parseFloat(annualReturn) || 0;
    const Y = parseInt(years) || 0;
    if (Y < 1) return null;

    const n = Y * 12;
    const totalPrincipal = P + PMT * n;

    if (rate === 0) {
      return { futureValue: totalPrincipal, totalPrincipal, marketYield: 0 };
    }

    const r = rate / 100 / 12;
    const growth = Math.pow(1 + r, n);
    const fvPrincipal = P * growth;
    const fvContributions = PMT * ((growth - 1) / r);
    const futureValue = fvPrincipal + fvContributions;
    const marketYield = futureValue - totalPrincipal;

    return { futureValue, totalPrincipal, marketYield };
  }, [principal, monthly, annualReturn, years]);

  const hasInput = parseFloat(principal) > 0 || parseFloat(monthly) > 0 || parseFloat(annualReturn) > 0 || parseInt(years) > 0;

  const inputBase = "w-full bg-input border-4 border-black rounded-2xl p-4 text-3xl font-black text-text-main outline-none focus:bg-surface transition-colors";

  const fmt = (val: number) =>
    val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">
            Wealth Growth
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
            Project your 10-year wealth trajectory.
          </p>
        </div>
        {hasInput && (
          <button
            type="button"
            onClick={() => { setPrincipal(''); setMonthly(''); setAnnualReturn(''); setYears(''); }}
            className="flex items-center gap-1.5 mt-2 text-[11px] font-bold uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
          >
            <RotateCcw size={11} strokeWidth={3} /> Reset
          </button>
        )}
      </div>

      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-5">
        {/* Starting Principal */}
        <div>
          <label className="label-xs block mb-2">Starting Principal ($)</label>
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-text-muted pointer-events-none">{currencySymbol()}</span>
            <input
              inputMode="decimal"
              placeholder="0"
              min="0"
              step="1000"
              value={principal}
              onChange={e => setPrincipal(sanitize(e.target.value))}
              onFocus={e => e.target.select()}
              className={`${inputBase} pl-10 focus:border-action-capture`}
            />
          </div>
        </div>

        {/* Monthly Contribution */}
        <div>
          <label className="label-xs block mb-2">Monthly Contribution ($)</label>
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-text-muted pointer-events-none">{currencySymbol()}</span>
            <input
              inputMode="decimal"
              placeholder="0"
              min="0"
              step="100"
              value={monthly}
              onChange={e => setMonthly(sanitize(e.target.value))}
              onFocus={e => e.target.select()}
              className={`${inputBase} pl-10 focus:border-action-primary`}
            />
          </div>
        </div>

        {/* Return + Years */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-xs block mb-2">Annual Return (%)</label>
            <div className="relative">
              <input
                inputMode="decimal"
                placeholder="0"
                min="0"
                max="30"
                step="0.5"
                value={annualReturn}
                onChange={e => setAnnualReturn(sanitize(e.target.value))}
                onFocus={e => e.target.select()}
                className={`${inputBase} pr-10 focus:border-action-capture`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-black text-text-muted pointer-events-none">%</span>
            </div>
          </div>
          <div>
            <label className="label-xs block mb-2">Time Horizon (Years)</label>
            <input
              inputMode="numeric"
              placeholder="10"
              min="1"
              max="50"
              step="1"
              value={years}
              onChange={e => setYears(sanitizeInt(e.target.value))}
              onFocus={e => e.target.select()}
              className={`${inputBase} focus:border-action-primary`}
            />
          </div>
        </div>
      </div>

      {metrics ? (
        <div className="space-y-4">
          {/* Future Value hero */}
          <div className="bg-surface border-4 border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black border-2 border-black rounded-full text-[10px] font-black tracking-widest uppercase mb-3 text-action-capture">
              <TrendingUp size={11} strokeWidth={3} /> Future Value
            </div>
            <p className="text-5xl md:text-6xl font-black italic leading-none tabular-nums text-capture-readable">
              {currencySymbol()}{fmt(metrics.futureValue)}
            </p>
            {parseInt(years) > 0 && (
              <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-3">
                After {years} year{parseInt(years) !== 1 ? 's' : ''} of compounding
              </p>
            )}
          </div>

          {/* Principal vs Yield */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
              <p className="label-xs mb-2">Total Principal</p>
              <p className="text-2xl font-black italic text-text-main tabular-nums">
                {currencySymbol()}{fmt(metrics.totalPrincipal)}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mt-1.5">Your money in</p>
            </div>
            <div className={`border-4 rounded-3xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${metrics.marketYield > 0 ? 'bg-black border-black' : 'bg-surface border-border shadow-[6px_6px_0px_0px_var(--shadow-color)]'}`}>
              <p className={`label-xs mb-2 ${metrics.marketYield > 0 ? 'text-capture-readable' : ''}`}>Market Yield</p>
              <p className={`text-2xl font-black italic tabular-nums ${metrics.marketYield > 0 ? 'text-capture-readable' : 'text-text-main'}`}>
                +{currencySymbol()}{fmt(metrics.marketYield)}
              </p>
              <p className={`text-[11px] font-bold uppercase tracking-wide mt-1.5 ${metrics.marketYield > 0 ? 'text-capture-readable/60' : 'text-text-muted'}`}>Free market growth</p>
            </div>
          </div>

          {/* Yield ratio bar */}
          {metrics.futureValue > 0 && (
            <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Capital Breakdown</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-capture-readable">
                  {((metrics.marketYield / metrics.futureValue) * 100).toFixed(1)}% free yield
                </p>
              </div>
              <div className="h-4 bg-input border-[3px] border-black rounded-full overflow-hidden flex">
                <motion.div
                  className="h-full bg-text-muted"
                  initial={{ width: 0 }}
                  animate={{ width: `${(metrics.totalPrincipal / metrics.futureValue) * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
                <div className="h-full flex-1 bg-action-capture" />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Principal</span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-capture-readable">Yield</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="border-4 border-dashed border-border rounded-3xl p-10 flex flex-col items-center gap-3">
          <AlertOctagon size={28} className="text-text-muted opacity-30" strokeWidth={1.5} />
          <p className="label-xs text-center">Enter your numbers to project compound growth</p>
        </div>
      )}
    </div>
  );
};
