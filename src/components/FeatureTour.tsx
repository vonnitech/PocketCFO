import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight } from 'lucide-react';
import { userKey } from '../lib/userScopedStorage';
import { useStore } from '../store/useStore';
import { currencySymbol } from '../lib/currency';
import { StackPiggyVaultIcon } from './StackPiggyIcons';

// Three cards, one idea each. The tour used to be six cards of a paragraph
// apiece, which is a lot to read before you have used anything. Everything it
// dropped (subscriptions, the ledger, offsetting a regret) is now explained by a
// one-time tip on the page itself, at the moment it is relevant.
//
// Each card opens with a tiny copy of the real thing it talks about (the daily
// number, the Log spend button, a vault filling up) rather than an icon, so the
// pieces are familiar the moment the tour closes. They use the theme colours,
// so they match whatever pairing the account has picked.
const STEPS = [
  {
    preview: 'today',
    title: 'Your number for today',
    body: "This is what you can spend today. Bills and savings are already set aside, and whatever you don't spend rolls into tomorrow.",
  },
  {
    preview: 'log',
    title: 'Log as you go',
    body: 'Tap Log spend when you buy something. Then Daily review checks the day in under a minute.',
  },
  {
    preview: 'vault',
    title: 'Give savings a home',
    body: 'Make a vault for each goal. Leftover cash and anything you save from your wishlist goes straight in.',
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

function StepPreview({ kind }: { kind: typeof STEPS[number]['preview'] }) {
  const sym = currencySymbol();
  if (kind === 'today') {
    return (
      <div className="inline-flex flex-col gap-1 bg-[#11110F] rounded-2xl px-4 py-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-action-primary">Today</span>
        <span className="text-3xl font-extrabold tracking-tight text-[#FFFDF8] tabular-nums leading-none">{sym}42.50</span>
      </div>
    );
  }
  if (kind === 'log') {
    return (
      <div className="flex flex-col items-start gap-2">
        <span className="inline-flex items-center h-10 px-5 bg-action-primary border-2 border-black dark:border-action-primary rounded-2xl text-primary-contrast font-black uppercase tracking-widest text-xs">
          + Log spend
        </span>
        <span className="inline-flex items-center gap-6 bg-input rounded-xl px-3 py-1.5 text-xs font-bold text-text-main">
          Coffee <span className="tabular-nums text-text-muted">-{sym}3.50</span>
        </span>
      </div>
    );
  }
  return (
    <div className="w-56 bg-input rounded-2xl px-3.5 py-3">
      <div className="flex items-center gap-2">
        <StackPiggyVaultIcon size={22} />
        <span className="flex-1 text-sm font-extrabold text-text-main">Holiday</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-text-muted">60%</span>
      </div>
      <div className="h-2 mt-2.5 bg-surface rounded-full overflow-hidden">
        <div className="h-full w-[60%] bg-action-capture rounded-full" />
      </div>
    </div>
  );
}

function StepContent({ step, isLast }: { step: typeof STEPS[number]; isLast: boolean }) {
  return (
    <div className="space-y-4">
      <div className="min-h-[84px] flex items-center">
        <StepPreview kind={step.preview} />
      </div>
      <div>
        <h2 className="text-xl font-black uppercase italic tracking-tighter text-text-main leading-tight mb-1.5">
          {step.title}
        </h2>
        <p className="text-[14px] font-bold text-text-muted leading-relaxed">
          {step.body}
        </p>
        {isLast && (
          <p className="text-[11px] font-bold text-text-muted/80 leading-relaxed mt-3">
            Each page shows you a short tip the first time you open it.
          </p>
        )}
      </div>
    </div>
  );
}

export function FeatureTour({ onDismiss }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
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

          {/* Step content. The cards have different amounts of text, and the
              sheet used to take each card's own height, so it jumped up or
              down on every Next and the buttons never sat in the same place.
              Every card is now laid out invisibly in the same grid cell, which
              sizes the box to the tallest one; the visible card sits on top. */}
          <div className="relative mb-6">
            <div aria-hidden className="invisible grid">
              {STEPS.map((s, i) => (
                <div key={i} className="[grid-area:1/1]">
                  <StepContent step={s} isLast={i === STEPS.length - 1} />
                </div>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ type: 'spring', stiffness: 400, damping: 38 }}
                className="absolute inset-0"
              >
                <StepContent step={current} isLast={isLast} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation. The left button is Skip on the first card and Back
              after it, at one fixed width, so Next is the same width and in
              the same place on all three cards. */}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={step === 0 ? onDismiss : () => setStep(s => s - 1)}
              className="h-11 w-20 shrink-0 border-2 border-border rounded-2xl text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-input transition-colors"
            >
              {step === 0 ? 'Skip' : 'Back'}
            </button>
            <button
              type="button"
              onClick={isLast ? onDismiss : () => setStep(s => s + 1)}
              className="flex-1 h-11 flex items-center justify-center gap-2 bg-black border-4 border-black rounded-2xl text-action-primary font-black uppercase tracking-widest text-[10px] shadow-[3px_3px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
            >
              {isLast ? 'Start using it' : (
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
