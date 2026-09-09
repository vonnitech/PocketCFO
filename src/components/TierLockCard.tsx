import { useState } from 'react';
import { motion } from 'motion/react';
import { Lock } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { formatCurrency } from '../lib/utils';
import { BottomSheet } from './BottomSheet';
import {
  SPEND_TIERS,
  calculateTierLimit,
  isTierLocked,
  tierLockDaysLeft,
} from '../core/math';

// The spend tier lives here rather than in Daily Review because it does the same
// job as pacing: it shapes today's number. Having it on the review screen meant
// the dashboard and the review showed two different daily figures with only one
// of them explaining why.
export function TierLockCard() {
  const { tierLock, setSpendTier, lockSpendTier, breakSpendTier, safeSpendLimit, privacyMode } =
    useStore(
      useShallow(s => ({
        tierLock: s.tierLock,
        setSpendTier: s.setSpendTier,
        lockSpendTier: s.lockSpendTier,
        breakSpendTier: s.breakSpendTier,
        safeSpendLimit: s.safeSpendLimit,
        privacyMode: s.privacyMode,
      })),
    );

  const [confirmOpen, setConfirmOpen] = useState(false);

  const locked = isTierLocked(tierLock);
  const daysLeft = tierLockDaysLeft(tierLock);
  const activeTier = SPEND_TIERS.find(t => t.id === tierLock.tierId) ?? SPEND_TIERS[1];
  const tierLimit = calculateTierLimit(safeSpendLimit, activeTier.multiplier);

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

        {!locked ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {SPEND_TIERS.map(tier => (
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

            <div>
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
              <div className="mt-3 pt-3 border-t-2 border-white/10 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Remaining</p>
                <p className="text-sm font-black text-white">{daysLeft} day{daysLeft !== 1 ? 's' : ''}</p>
              </div>
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

        <div className="flex justify-between items-center border-t-2 border-border/30 pt-3 gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Today at {activeTier.label}
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
              {daysLeft} day{daysLeft !== 1 ? 's' : ''} left. Your daily number goes back to the
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
