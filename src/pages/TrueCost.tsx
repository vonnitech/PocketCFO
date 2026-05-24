import React, { useState, useMemo } from 'react';
import { Flame, AlertOctagon, RotateCcw } from 'lucide-react';

export const TrueCost: React.FC = () => {
  const [price, setPrice] = useState('');
  const [apr, setApr] = useState('');
  const [term, setTerm] = useState('');

  const sanitize = (val: string) => val.replace(/[^0-9.]/g, '');
  const sanitizeInt = (val: string) => val.replace(/[^0-9]/g, '');

  const metrics = useMemo(() => {
    const P = Math.max(0, parseFloat(price) || 0);
    const annualRate = Math.max(0, parseFloat(apr) || 0);
    const n = Math.max(1, parseInt(term) || 0);
    if (P === 0 || parseInt(term) < 1) return null;
    if (annualRate === 0) return { monthly: P / n, total: P, interest: 0 };
    const r = (annualRate / 100) / 12;
    const discountFactor = Math.pow(1 + r, -n);
    const monthly = (P * r) / (1 - discountFactor);
    const total = monthly * n;
    return { monthly, total, interest: total - P };
  }, [price, apr, term]);

  const hasInput = parseFloat(price) > 0 || parseFloat(apr) > 0 || parseInt(term) > 0;

  const inputBase = "w-full bg-input border-4 border-black rounded-2xl p-4 text-3xl font-black text-text-main outline-none focus:bg-surface transition-colors";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Reality Check</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">True cost of financing</p>
        </div>
        {hasInput && (
          <button
            type="button"
            onClick={() => { setPrice(''); setApr(''); setTerm(''); }}
            className="flex items-center gap-1.5 mt-2 text-[11px] font-bold uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
          >
            <RotateCcw size={11} strokeWidth={3} /> Reset
          </button>
        )}
      </div>

      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-5">
        {/* Sticker Price */}
        <div>
          <label className="label-xs block mb-2">Sticker Price</label>
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-text-muted pointer-events-none">$</span>
            <input
              inputMode="decimal"
              placeholder="0"
              min="0"
              value={price}
              onChange={e => setPrice(sanitize(e.target.value))}
              onFocus={e => e.target.select()}
              className={`${inputBase} pl-10 focus:border-action-capture`}
            />
          </div>
        </div>

        {/* APR + Term */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-xs block mb-2">APR (%)</label>
            <div className="relative">
              <input
                inputMode="decimal"
                placeholder="0"
                min="0"
                max="100"
                value={apr}
                onChange={e => setApr(sanitize(e.target.value))}
                onFocus={e => e.target.select()}
                className={`${inputBase} pr-10 focus:border-action-bleed`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-black text-text-muted pointer-events-none">%</span>
            </div>
          </div>
          <div>
            <label className="label-xs block mb-2">Term (months)</label>
            <input
              inputMode="numeric"
              placeholder="0"
              min="1"
              value={term}
              onChange={e => setTerm(sanitizeInt(e.target.value))}
              onFocus={e => e.target.select()}
              className={`${inputBase} focus:border-action-primary`}
            />
          </div>
        </div>
      </div>

      {metrics ? (
        <div className="space-y-4">
          {/* Interest burned hero */}
          {metrics.interest > 0 ? (
            <div className="bg-action-bleed border-4 border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-white/70 text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 mb-2">
                <Flame size={11} strokeWidth={3} /> Interest burned
              </p>
              <p className="text-5xl md:text-6xl font-black italic text-white leading-none">
                +${metrics.interest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-3">
                {((metrics.interest / parseFloat(price)) * 100).toFixed(1)}% on top · pure wealth surrender
              </p>
            </div>
          ) : (
            <div className="bg-action-capture border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-black font-black uppercase tracking-widest text-sm">Zero interest · clean deal</p>
            </div>
          )}

          {/* Monthly + Total */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
              <p className="label-xs mb-2">Monthly Hit</p>
              <p className="text-2xl font-black italic text-text-main tabular-nums">
                ${metrics.monthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
              <p className="label-xs mb-2">Total Drain</p>
              <p className="text-2xl font-black italic text-text-main tabular-nums">
                ${metrics.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-4 border-dashed border-border rounded-3xl p-10 flex flex-col items-center gap-3">
          <AlertOctagon size={28} className="text-text-muted opacity-30" strokeWidth={1.5} />
          <p className="label-xs text-center">Enter price + term to see the real cost</p>
        </div>
      )}
    </div>
  );
};
