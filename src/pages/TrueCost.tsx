import React, { useState, useMemo } from 'react';
import { Flame, RotateCcw, TrendingUp, Clock } from 'lucide-react';
import { useStore } from '../store/useStore';
import { currencySymbol } from '../lib/currency';

function contrastText(hex?: string): string {
  if (!hex || hex.length < 7) return 'text-black';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.45 ? 'text-black' : 'text-white';
}

// Assumed long-run index-fund return used for the opportunity-cost projection.
const ASSUMED_ANNUAL_RETURN = 0.08;

// Money to 2dp, "days" to 1dp; both return 0 for non-finite values (e.g. divide-by-zero).
const round2 = (x: number) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : 0);
const round1 = (x: number) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : 0);

interface CostResult {
  monthlyPayment: number;   // standard loan amortization payment
  totalCost: number;        // monthlyPayment * termMonths
  banksCut: number;         // total interest = totalCost - sticker price
  opportunityCost: number;  // future value if that payment were invested instead
}

// Core loan math. Returns null for invalid inputs (no price, or term < 1 month).
function computeCost(P: number, annualRate: number, n: number): CostResult | null {
  if (P <= 0 || n < 1) return null;
  const r = (annualRate / 100) / 12;
  const monthlyPayment = r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n));
  const totalCost = monthlyPayment * n;
  const banksCut = totalCost - P;
  // Opportunity cost = FV of an annuity: invest `monthlyPayment` every month at 8%/yr.
  const i = ASSUMED_ANNUAL_RETURN / 12;
  const opportunityCost = monthlyPayment * ((Math.pow(1 + i, n) - 1) / i);
  return {
    monthlyPayment: round2(monthlyPayment),
    totalCost: round2(totalCost),
    banksCut: round2(banksCut),
    opportunityCost: round2(opportunityCost),
  };
}

// Life Energy: how many 8-hour workdays the total cost represents at a given wage.
function lifeEnergyDays(totalCost: number, hourlyWage: number): number | null {
  if (hourlyWage <= 0) return null;
  return round1((totalCost / hourlyWage) / 8);
}

// Shown in the empty state so the page isn't bare before you type anything.
const EXAMPLE = { price: 20000, apr: 18, term: 48 };
const EXAMPLE_RESULT = computeCost(EXAMPLE.price, EXAMPLE.apr, EXAMPLE.term)!;

export const TrueCost: React.FC = () => {
  const { themeColors } = useStore();
  const captureTxt = contrastText(themeColors?.secondary);
  const [price, setPrice] = useState('');   // sticker price
  const [apr, setApr] = useState('');
  const [term, setTerm] = useState('');     // term in months
  const [wage, setWage] = useState('');     // hourly wage (for Life Energy)

  const sanitize = (val: string) => val.replace(/[^0-9.]/g, '');
  const sanitizeInt = (val: string) => val.replace(/[^0-9]/g, '');

  // Full reality-check engine: loan math + opportunity cost + life energy. Returns the
  // clean data object the UI maps from, or null when inputs aren't ready.
  const metrics = useMemo(() => {
    // parseInt('') is NaN, and `NaN < 1` is false — so guard on a finite term to
    // avoid falling through and computing results as if the term were 1 month.
    const termMonths = parseInt(term);
    if (!Number.isFinite(termMonths) || termMonths < 1) return null;
    const base = computeCost(
      Math.max(0, parseFloat(price) || 0),
      Math.max(0, parseFloat(apr) || 0),
      termMonths,
    );
    if (!base) return null;
    return { ...base, lifeEnergyDays: lifeEnergyDays(base.totalCost, Math.max(0, parseFloat(wage) || 0)) };
  }, [price, apr, term, wage]);

  const hasInput = parseFloat(price) > 0 || parseFloat(apr) > 0 || parseInt(term) > 0 || parseFloat(wage) > 0;

  // Matches the rest of the app's soft-brutalist style: grey field, heavy border,
  // large rounded corners, accent-colored focus. Symbols are permanent prefix/suffix.
  const registerBox = "flex items-center gap-2 bg-input border-4 border-black rounded-2xl px-4 py-3 transition-colors focus-within:bg-surface focus-within:border-action-capture";
  const registerInput = "flex-1 min-w-0 bg-transparent text-3xl font-black text-text-main outline-none placeholder:text-text-muted/40 tabular-nums";
  const registerLabel = "label-xs block mb-2";
  const registerFix = "shrink-0 text-2xl font-black text-text-muted pointer-events-none select-none";

  // Result cards for the live calculation.
  const renderResults = (m: CostResult & { lifeEnergyDays?: number | null }, basePrice: number) => (
    <div className="space-y-4">
      {m.banksCut > 0 ? (
        <div className="bg-action-bleed border-4 border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-white/70 text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 mb-2">
            <Flame size={11} strokeWidth={3} /> Interest burned
          </p>
          <p className="text-5xl md:text-6xl font-black italic text-white leading-none">
            +{currencySymbol()}{m.banksCut.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-3">
            {((m.banksCut / basePrice) * 100).toFixed(1)}% on top · pure wealth surrender
          </p>
        </div>
      ) : (
        <div className="bg-action-capture border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <p className={`font-black uppercase tracking-widest text-sm ${captureTxt}`}>Zero interest · clean deal</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <p className="label-xs mb-2">Monthly Hit</p>
          <p className="text-2xl font-black italic text-text-main tabular-nums">
            {currencySymbol()}{m.monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <p className="label-xs mb-2">Total Drain</p>
          <p className="text-2xl font-black italic text-text-main tabular-nums">
            {currencySymbol()}{m.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Opportunity cost — those same payments invested at 8%/yr instead */}
      {m.opportunityCost > 0 && (
        <div className="bg-black border-4 border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 mb-2 text-capture-readable">
            <TrendingUp size={11} strokeWidth={3} /> If you invested instead
          </p>
          <p className="text-4xl md:text-5xl font-black italic leading-none tabular-nums text-capture-readable">
            {currencySymbol()}{m.opportunityCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-capture-readable/60 text-[10px] font-bold uppercase tracking-widest mt-3">
            Same payments at 8%/yr for the full term
          </p>
        </div>
      )}

      {/* Life energy — total cost expressed as 8-hour workdays of pay */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <p className="label-xs mb-2 flex items-center gap-1.5">
          <Clock size={11} strokeWidth={3} /> Life Energy
        </p>
        {m.lifeEnergyDays != null ? (
          <>
            <p className="text-3xl font-black italic text-text-main tabular-nums">
              {m.lifeEnergyDays.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              <span className="text-[1rem] text-text-muted not-italic"> workdays</span>
            </p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mt-1.5">
              8-hour days of your pay to cover it
            </p>
          </>
        ) : (
          <p className="text-sm font-bold uppercase tracking-wide text-text-muted">
            Add your hourly wage to see this
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">True Cost</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">True cost of financing</p>
        </div>
        {hasInput && (
          <button
            type="button"
            onClick={() => { setPrice(''); setApr(''); setTerm(''); setWage(''); }}
            className="flex items-center gap-1.5 mt-2 text-[11px] font-bold uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
          >
            <RotateCcw size={11} strokeWidth={3} /> Reset
          </button>
        )}
      </div>

      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-5">
        {/* Sticker Price */}
        <div>
          <label htmlFor="tc-price" className={registerLabel}>Sticker Price</label>
          <div className={registerBox}>
            <span className={registerFix}>{currencySymbol()}</span>
            <input
              id="tc-price"
              inputMode="decimal"
              placeholder="0"
              min="0"
              value={price}
              onChange={e => setPrice(sanitize(e.target.value))}
              onFocus={e => e.target.select()}
              className={registerInput}
            />
          </div>
        </div>

        {/* APR + Term */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="tc-apr" className={registerLabel}>APR</label>
            <div className={registerBox}>
              <input
                id="tc-apr"
                inputMode="decimal"
                placeholder="0"
                min="0"
                max="100"
                value={apr}
                onChange={e => setApr(sanitize(e.target.value))}
                onFocus={e => e.target.select()}
                className={registerInput}
              />
              <span className={registerFix}>%</span>
            </div>
          </div>
          <div>
            <label htmlFor="tc-term" className={registerLabel}>Term</label>
            <div className={registerBox}>
              <input
                id="tc-term"
                inputMode="numeric"
                placeholder="0"
                min="1"
                value={term}
                onChange={e => setTerm(sanitizeInt(e.target.value))}
                onFocus={e => e.target.select()}
                className={registerInput}
              />
              <span className={`${registerFix} text-sm tracking-widest`}>MO</span>
            </div>
          </div>
        </div>

        {/* Hourly wage — drives the Life Energy metric (workdays the cost represents) */}
        <div>
          <label htmlFor="tc-wage" className={registerLabel}>Your Hourly Wage</label>
          <div className={registerBox}>
            <span className={registerFix}>{currencySymbol()}</span>
            <input
              id="tc-wage"
              inputMode="decimal"
              placeholder="0"
              min="0"
              value={wage}
              onChange={e => setWage(sanitize(e.target.value))}
              onFocus={e => e.target.select()}
              className={registerInput}
            />
            <span className={`${registerFix} text-sm tracking-widest`}>/HR</span>
          </div>
        </div>
      </div>

      {metrics ? (
        renderResults(metrics, parseFloat(price) || 0)
      ) : (
        // Empty state: a plain, factual example so the page shows real numbers before input.
        <div className="bg-surface border-4 border-border rounded-3xl p-6 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-2">
          <p className="label-xs">Example</p>
          <p className="text-xl sm:text-2xl font-black tracking-tight text-text-main leading-snug tabular-nums">
            {currencySymbol()}{EXAMPLE.price.toLocaleString()} at {EXAMPLE.apr}% over {EXAMPLE.term} months ={' '}
            <span className="text-action-bleed">+{currencySymbol()}{Math.round(EXAMPLE_RESULT.banksCut).toLocaleString()}</span> interest
          </p>
          <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
            {currencySymbol()}{Math.round(EXAMPLE_RESULT.totalCost).toLocaleString()} total · enter your numbers above to see yours
          </p>
        </div>
      )}
    </div>
  );
};
