import { Link } from 'react-router-dom';
import { TierLockCard } from '../components/TierLockCard';

// Split off the pacing screen, which it used to share.
//
// The two controls compound: calculateTrueSafeSpend applies the tier, and the
// pacing then reshapes whatever that leaves. Sitting them under one heading
// invited the reading that they were alternatives, or two dials on the same
// mechanism, when one sets how much there is and the other sets when it arrives.
//
// The link at the bottom is not decoration either. The pacing screen works off
// the tiered figure, so anyone changing a tier has just moved the number the
// other screen is shaping, and that is worth saying once rather than leaving
// them to notice it.
export default function SpendLimit() {
  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <div>
        <h1 className="text-4xl font-black uppercase tracking-tighter leading-tight italic text-text-main">
          Spend Limit
        </h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
          Sets how much of the daily allowance you let yourself use
        </p>
      </div>

      <TierLockCard />

      <Link
        to="/pacing"
        className="flex items-center justify-between gap-3 bg-surface border-4 border-border rounded-2xl px-4 py-3 hover:border-black transition-colors"
      >
        <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted leading-snug">
          Pacing spreads whatever this leaves across the days to payday
        </span>
        <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-text-main">
          Pacing →
        </span>
      </Link>
    </div>
  );
}
