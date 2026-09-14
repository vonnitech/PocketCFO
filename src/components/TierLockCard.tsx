import { useState } from 'react';
import { motion } from 'motion/react';
import { Lock } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { formatCurrency } from '../lib/utils';
import { BottomSheet } from './BottomSheet';
import {
  SPEND_TIERS,
  isTierLocked,
  tierLockDaysLeft,
} from '../core/math';

// The spend tier lives here rather than in Daily Review because it does the same
// job as pacing: it shapes today's number. Having it on the review screen meant
// the dashboard and the review showed two different daily figures with only one
// of them explaining why.
export function TierLockCard() {
  const { tierLock, setSpendTier, lockSpendTier, breakSpendTier, clearPendingOutcome, safeSpendLimit, privacyMode } =
    useStore(
      useShallow(s => ({
        tierLock: s.tierLock,
        setSpendTier: s.setSpendTier,
        lockSpendTier: s.lockSpendTier,
        breakSpendTier: s.breakSpendTier,
        clearPendingOutcome: s.clearPendingOutcome,
        safeSpendLimit: s.safeSpendLimit,
        privacyMode: s.privacyMode,
      })),
    );

  const [confirmOpen, setConfirmOpen] = useState(false);

  const locked = isTierLocked(tierLock);
  const daysLeft = tierLockDaysLeft(tierLock);
  const activeTier = SPEND_TIERS.find(t => t.id === tierLock.tierId) ?? SPEND_TIERS[0];
  // FULL is the absence of a tier, so it gets its own row rather than a cell in
  // the grid of handicaps, and there is nothing to hold yourself to while it is
  // selected.
  const atFull = tierLock.tierId === 'FULL';
  const challengeTiers = SPEND_TIERS.filter(t => t.id !== 'FULL');

  // Where you are, not just what is left. A hold that can only count down tells
  // you about the part you have not done yet; this is the half that helps while
  // it is still running.
  const dayOf = locked && tierLock.lockedDays > 0
    ? Math.min(tierLock.lockedDays, tierLock.lockedDays - daysLeft + 1)
    : 0;

  const done = tierLock.pending;
  const doneTier = done ? SPEND_TIERS.find(t => t.id === done.tierId) : undefined;
  const hasRecord = tierLock.completed > 0 || tierLock.broken > 0;
  // safeSpendLimit already carries the tier AND the pacing, so this is the
  // number the dashboard shows. Multiplying again would give 75% of 75%.
  const tierLimit = safeSpendLimit;

  const endLock = async () => {
    await breakSpendTier();
    setConfirmOpen(false);
  };

  return (
    <>
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-4">
        <div className="inline-flex px-3 py-1 bg-black border-2 border-action-primary rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase">
          Spend Tier
        </div>

        {/* Finishing a hold used to produce nothing at all: the date passed, the
            lock was quietly dropped on the next load, and the app carried on as
            though it had never happened. Ending one early, by contrast, fired an
            action and wrote a number down. This is the missing half.

            Stated plainly, with no praise language. A figure for what the hold
            actually held back would be better, but it cannot be computed after
            the fact: the daily allowance moves with the balance and the days
            left, so the only honest version needs a value captured when the hold
            starts. That is a small addition if it is wanted. */}
        {done && (
          <div className="border-4 border-black bg-black rounded-2xl p-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-action-primary">
              {done.result === 'completed' ? 'Hold finished' : 'Hold ended early'}
            </p>
            <p className="text-2xl font-black italic uppercase text-white leading-none">
              {done.days > 0 ? `${done.days} day${done.days === 1 ? '' : 's'} at ` : ''}
              {doneTier?.label ?? done.tierId}
            </p>
            {/* "About", and it is not decoration. This is days served times the
                gap between the untiered and tiered allowance at the moment the
                hold started. The real allowance drifts with the balance and the
                days to payday, so the figure is a fair account of what the tier
                withheld, not a measured one. It is also not a claim about what
                was saved: whether the money stayed put depends on spending, and
                the app does not know that from this number alone. */}
            {done.heldBack > 0 && (
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/60 leading-snug">
                About {formatCurrency(done.heldBack, privacyMode)} held back during this hold
              </p>
            )}
            <button
              type="button"
              onClick={() => { void clearPendingOutcome(); }}
              className="w-full h-10 bg-action-primary border-2 border-black rounded-xl text-primary-contrast font-black uppercase tracking-widest text-[10px]"
            >
              Got it
            </button>
          </div>
        )}

        {!locked ? (
          <>
            <button
              type="button"
              onClick={() => setSpendTier('FULL')}
              className={`w-full flex items-center justify-between gap-3 p-3 border-4 rounded-2xl transition-all ${
                atFull
                  ? 'bg-black border-black text-action-primary shadow-[4px_4px_0px_0px_var(--color-action-primary)]'
                  : 'bg-input border-border text-text-muted hover:border-black'
              }`}
            >
              <span className="font-black text-xs uppercase tracking-widest">Full Amount</span>
              <span className={`text-[10px] font-bold uppercase tracking-wide ${atFull ? 'text-action-primary/60' : 'text-text-muted'}`}>
                No reduction
              </span>
            </button>

            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Or hold yourself to less
            </p>

            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
              {challengeTiers.map(tier => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSpendTier(tier.id)}
                  className={`flex items-center justify-center p-3 border-4 rounded-2xl transition-all ${
                    tierLock.tierId === tier.id
                      ? `${tier.color} border-black shadow-brutal-sm ${tier.textColor}`
                      : 'bg-input border-border text-text-muted hover:border-black'
                  }`}
                >
                  <span className="font-black text-xs uppercase">{tier.label}</span>
                </button>
              ))}
            </div>

            <div className={atFull ? 'hidden' : ''}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">
                Hold this tier for
              </p>
              <div className="flex gap-2">
                {[7, 14, 30].map(days => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => lockSpendTier(days)}
                    className="flex-1 h-10 bg-input border-2 border-border rounded-xl text-[10px] font-black uppercase tracking-widest text-text-muted hover:border-black hover:text-text-main transition-all"
                  >
                    {days}d
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-2 leading-snug">
                Optional. Holding it means you cannot switch tiers until it ends.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="border-4 border-black bg-black rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lock size={12} strokeWidth={2.5} className="text-action-primary shrink-0" />
                <p className="text-[10px] font-black uppercase tracking-widest text-action-primary">Held</p>
              </div>
              <p className="text-2xl font-black italic uppercase text-action-primary leading-none mb-1">
                {activeTier.label} Mode
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                Until {new Date(tierLock.lockedUntil!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              <div className="mt-3 pt-3 border-t-2 border-white/10 flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                  {dayOf > 0 ? `Day ${dayOf} of ${tierLock.lockedDays}` : 'Remaining'}
                </p>
                <p className="text-sm font-black text-white shrink-0">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</p>
              </div>
              {dayOf > 0 && (
                <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-action-primary"
                    style={{ width: `${Math.round((dayOf / tierLock.lockedDays) * 100)}%` }}
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="w-full h-10 border-2 border-border rounded-xl text-[10px] font-black uppercase tracking-widest text-text-muted hover:border-black hover:text-text-main transition-colors"
            >
              End Early
            </button>
          </>
        )}

        {/* Both halves or neither. A lone count of the times you gave up is a
            verdict; the same number beside what you finished is a record. */}
        {hasRecord && (
          <div className="flex items-center gap-4 border-t-2 border-border/30 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Finished <span className="text-text-main font-black">{tierLock.completed}</span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Ended early <span className="text-text-main font-black">{tierLock.broken}</span>
            </span>
          </div>
        )}

        <div className="flex justify-between items-center border-t-2 border-border/30 pt-3 gap-3">
          {/* Not "Today at {tier}": this figure has the weekday trim in it as
              well, so labelling it with the tier alone made the tier look like
              it had taken far more than its own percentage. On a 90% tier with
              a weekend-loaded pace it read "today at easy: $155" when easy on
              its own was $311. It matches the dashboard, so it is named the
              same thing the dashboard names it. */}
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Cleared today
          </span>
          <span className="font-black text-xl text-text-main tabular-nums">
            {formatCurrency(tierLimit, privacyMode)}
          </span>
        </div>
      </div>

      {/* Ending a hold early is a decision, not a confession. The old sheet was
          titled COMMITMENT BREACH, counted your failures back at you, and made
          the confirm button read "Yes, I'm giving up". That is the same voice the
          Impulse Tax used, and it left the app scolding in one flow while it had
          stopped scolding in the other. */}
      <BottomSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="END THE HOLD">
        <div className="space-y-5 py-2">
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-text-main leading-tight">
              End {activeTier.label} mode early?
            </h2>
            <p className="text-[12px] font-bold text-text-muted mt-2 leading-relaxed uppercase tracking-wide">
              {daysLeft} day{daysLeft !== 1 ? 's' : ''} left. Your Cleared Today amount goes back to the
              full amount, and you can pick a new tier whenever you want.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="w-full h-12 bg-black border-4 border-black rounded-2xl text-action-primary font-black uppercase tracking-widest text-[11px] shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
          >
            Keep the hold
          </button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={endLock}
            className="w-full h-10 border-2 border-border rounded-2xl text-text-muted font-black uppercase tracking-widest text-[10px] hover:border-black hover:text-text-main transition-colors"
          >
            End it
          </motion.button>
        </div>
      </BottomSheet>
    </>
  );
}
