import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Zap, ShieldCheck, Scissors, List, TrendingUp, X, ChevronRight } from 'lucide-react';
import { userKey } from '../lib/userScopedStorage';
import { useStore } from '../store/useStore';

const STEPS = [
  {
    icon: Wallet,
    color: 'bg-action-capture',
    title: 'Your Daily Limit',
    body: 'Your dashboard shows one number: your cleared daily allowance. It sets your bills and savings aside first, then spreads the rest across the days until payday. Spend less today and the leftover rolls into tomorrow.',
  },
  {
    icon: Zap,
    color: 'bg-action-primary',
    title: 'Review Each Day',
    body: 'Log purchases from the Dashboard as they happen, then open Daily Review to check the total and catch anything missed. The review keeps your number honest without double-counting quick logs.',
  },
  {
    icon: ShieldCheck,
    color: 'bg-action-capture',
    title: 'Impulse Tax',
    body: 'Logging a purchase you regret? Toggle "Impulse Buy" to add a self-imposed tax. The penalty is earmarked into your first vault, a nudge to move that cash and make bad habits cost you.',
  },
  {
    icon: TrendingUp,
    color: 'bg-action-primary',
    title: 'Savings Vaults',
    body: 'Create vaults for specific goals like an emergency fund, a holiday, or a new phone. Impulse taxes and leftover surplus get earmarked into them so you can watch each goal fill up, then move the real money in your bank to match.',
  },
  {
    icon: Scissors,
    color: 'bg-action-capture',
    title: 'Cancel Subscriptions',
    body: 'Open Subscriptions to audit every recurring charge. Mark anything Idle or Low Use to spot what to cancel. Forgotten subscriptions are silent leaks.',
  },
  {
    icon: List,
    color: 'bg-black',
    title: 'Ledger & Audit',
    body: 'Your Ledger lists every transaction, and the Audit Log breaks down where your money went with a month over month view. Check in weekly for a full review.',
  },
] as const;

const TOUR_BASE = 'pocket-cfo-tour-v1';

export function useFeatureTour() {
  const userId = useStore(s => s.userId);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!userId) {
      setVisible(false);
      return;
    }
    try {
      setVisible(!localStorage.getItem(userKey(TOUR_BASE)));
    } catch {
      setVisible(true);
    }
  }, [userId]);

  const dismiss = () => {
    try {
      localStorage.setItem(userKey(TOUR_BASE), '1');
    } catch {}
    setVisible(false);
  };

  return { visible, dismiss };
}

interface Props {
  onDismiss: () => void;
}

export function FeatureTour({ onDismiss }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] bg-black/60 flex items-end justify-center md:items-center md:p-8"
      onClick={e => { if (e.target === e.currentTarget) onDismiss(); }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 40 }}
        className="w-full md:max-w-sm max-h-[78vh] md:max-h-[90vh] overflow-y-auto bg-surface border-t-4 md:border-4 border-border rounded-t-3xl md:rounded-3xl shadow-[0px_-6px_0px_0px_rgba(0,0,0,0.15)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
      >
        <div className="px-5 pt-5 pb-6">
          {/* Top row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? 'w-5 bg-black dark:bg-white' : i < step ? 'w-1.5 bg-black/30 dark:bg-white/30' : 'w-1.5 bg-border'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              title="Skip tour"
              onClick={onDismiss}
              className="w-8 h-8 flex items-center justify-center rounded-xl border-2 border-border text-text-muted hover:bg-input transition-colors"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ type: 'spring', stiffness: 400, damping: 38 }}
              className="space-y-4 mb-6"
            >
              <div className={`w-12 h-12 ${current.color} border-4 border-black rounded-2xl flex items-center justify-center shadow-brutal-sm`}>
                <Icon size={20} strokeWidth={3} className={current.color === 'bg-black' ? 'text-action-primary' : 'text-black'} />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter text-text-main leading-tight mb-1.5">
                  {current.title}
                </h2>
                <p className="text-[12px] font-bold text-text-muted leading-relaxed">
                  {current.body}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex gap-2.5">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="h-11 px-4 border-2 border-border rounded-2xl text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-input transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={isLast ? onDismiss : () => setStep(s => s + 1)}
              className="flex-1 h-11 flex items-center justify-center gap-2 bg-black border-4 border-black rounded-2xl text-action-primary font-black uppercase tracking-widest text-[10px] shadow-[3px_3px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
            >
              {isLast ? "Got it · let’s go" : (
                <>Next <ChevronRight size={13} strokeWidth={3} /></>
              )}
            </button>
          </div>

          <p className="text-center text-[10px] font-bold uppercase tracking-widest text-text-muted mt-3">
            {step + 1} of {STEPS.length} · tap outside to dismiss
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
