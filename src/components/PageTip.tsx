import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Lightbulb, X } from 'lucide-react';
import { userKey } from '../lib/userScopedStorage';
import { useStore } from '../store/useStore';

// One short tip per page, shown the first time someone opens it and never again
// once closed. This is where the detail lives that the three-card tour leaves
// out: each tip turns up on the screen it is about, at the moment it is useful,
// instead of all at once before the user has seen any of it.
//
// One sentence or two, each. If a tip needs more than that, the page itself is
// what needs fixing.
const TIPS: Record<string, string> = {
  '/daily':         'Check the day in one go. Mark a spend you regret and you can move the same amount into a vault.',
  '/transactions':  'Every spend, bill and vault move, newest first.',
  '/vaults':        'Make one vault for each goal. Investment vaults also count toward your FIRE number.',
  '/breakdown':     'See where your money went this month, next to last month.',
  '/subscriptions': 'List every subscription and mark the ones you barely use. Those are the easiest money to win back.',
  '/limit':         'Choose to spend only part of what is cleared, like 75%, and keep the rest.',
  '/pacing':        'Decide how your money spreads across the week: the same every day, or more at the weekend.',
  '/wishlist':      'Write down what you want instead of buying it today. Each item shows how many days of spending it costs.',
  '/fire':          'See when your investments could cover your spending for good. Your Investment vaults are counted for you.',
  '/split':         'Split a bill with friends and keep track of who still owes you.',
  '/true-cost':     'See what a purchase really costs once you count the hours you worked for it.',
  '/debt':          'Pick an order to pay off your debts and see the date you will be clear.',
  '/safety-net':    'See how long your cash would last, and how big a buffer to aim for.',
  '/income':        'Log your income milestones and see the savings rate your FIRE plan needs.',
};

const STORE_BASE = 'pocket-cfo-page-tips-v1';

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(userKey(STORE_BASE));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

function markSeen(path: string): void {
  try {
    const seen = new Set(readSeen());
    seen.add(path);
    localStorage.setItem(userKey(STORE_BASE), JSON.stringify([...seen]));
  } catch {}
}

/** Renders above the page content. `suppressed` holds it back while the tour is open. */
export function PageTip({ suppressed = false }: { suppressed?: boolean }) {
  const { pathname } = useLocation();
  const userId = useStore(s => s.userId);
  const path = pathname.replace(/\/+$/, '') || '/';
  const tip = TIPS[path];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!!tip && !!userId && !readSeen().includes(path));
  }, [path, tip, userId]);

  const close = () => {
    markSeen(path);
    setVisible(false);
  };

  return (
    <AnimatePresence initial={false}>
      {visible && !suppressed && tip && (
        <motion.div
          key={path}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          role="note"
          className="mb-4 flex items-start gap-3 rounded-2xl border-[3px] border-border bg-surface px-4 py-3"
        >
          <Lightbulb size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-primary-readable" />
          <p className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-text-main">{tip}</p>
          <button
            type="button"
            onClick={close}
            aria-label="Got it, hide this tip"
            className="shrink-0 -mr-1 -mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-input hover:text-text-main"
          >
            <X size={14} strokeWidth={3} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
