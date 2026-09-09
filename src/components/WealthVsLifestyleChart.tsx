import { useMemo } from 'react';
import { useStore } from '../store/useStore';

// Categories whose dollars build the user's future net worth.
//   VAULT_DEPOSIT — money moved into a vault / investment vault
//   DEBT_PAYMENT  — paying down debt directly grows future net worth
const FUTURE_CATEGORIES = new Set(['VAULT_DEPOSIT', 'DEBT_PAYMENT']);

// Discretionary present-tense spending — the lifestyle bucket. We exclude
// recurring bills, home, utilities, transport, health, and work since those
// are fixed obligations rather than lifestyle choices.
const LIFESTYLE_CATEGORIES = new Set(['FOOD', 'FUN', 'SHOPPING', 'SOCIAL', 'PENALTY']);

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function WealthVsLifestyleChart() {
  const transactions = useStore(s => s.transactions);

  const { futureTotal, lifestyleTotal } = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let f = 0;
    let l = 0;
    for (const tx of transactions) {
      if (new Date(tx.date) < monthStart) continue;
      const amt = tx.amount + (tx.flipAmount || 0);
      if (FUTURE_CATEGORIES.has(tx.category))         f += amt;
      else if (LIFESTYLE_CATEGORIES.has(tx.category)) l += amt;
    }
    return { futureTotal: f, lifestyleTotal: l };
  }, [transactions]);

  const hasAny = futureTotal > 0 || lifestyleTotal > 0;

  // Both bars share one scale — the larger value pins to 100% and the length
  // difference IS the comparison. No axis, no ticks: the blocks tell the story.
  const max          = Math.max(futureTotal, lifestyleTotal, 1);
  const lifestylePct = (lifestyleTotal / max) * 100;
  const futurePct    = (futureTotal    / max) * 100;

  return (
    <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">

      {/* Title — CFO framing, brutalist headline scale */}
      <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tighter italic text-text-main leading-tight mb-1">
        Capital Allocation: Present vs Future
      </h2>
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
        {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </p>

      {hasAny ? (
        <div className="flex flex-col gap-6 mt-6">

          {/* Track 1: Living (present spend) */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
              <span className="text-sm font-black uppercase text-text-main">Living</span>
              <span className="text-lg font-black tabular-nums text-text-main">{fmtMoney(lifestyleTotal)}</span>
            </div>
            <div className="w-full h-8 bg-gray-200 dark:bg-gray-800 border-2 border-black dark:border-white rounded-lg overflow-hidden">
              <div
                // eslint-disable-next-line react/forbid-dom-props
                style={{ width: `${lifestylePct}%` }}
                className="h-full bg-action-primary border-r-2 border-black dark:border-white transition-all duration-500"
              />
            </div>
          </div>

          {/* Track 2: Future Wealth */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
              <span className="text-sm font-black uppercase text-text-main">Future Wealth</span>
              <span className="text-lg font-black tabular-nums text-text-main">{fmtMoney(futureTotal)}</span>
            </div>
            <div className="w-full h-8 bg-gray-200 dark:bg-gray-800 border-2 border-black dark:border-white rounded-lg overflow-hidden">
              <div
                // eslint-disable-next-line react/forbid-dom-props
                style={{ width: `${futurePct}%` }}
                className="h-full bg-action-capture border-r-2 border-black dark:border-white transition-all duration-500"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-input border-4 border-black py-10 px-4 text-center mt-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">
            No tracked activity this month yet
          </p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mt-1">
            Log a vault deposit or log spend to see your split
          </p>
        </div>
      )}

      {/* Definition footer — clean legend, piped not mathematical */}
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-4 pt-4 border-t-2 border-gray-200 dark:border-gray-800">FUTURE WEALTH: Vaults, Debt Payoff <span className="mx-2">|</span> LIFESTYLE BURN: Food, Fun, Shopping, Social</p>
    </div>
  );
}
