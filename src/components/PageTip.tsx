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
  '/daily':         "Go over today's spending in one place. If you regret a spend, you can put the same amount into a vault.",
  '/transactions':  'This lists all your spending, bills and vault transfers, newest at the top.',
  '/vaults':        'Make one vault for each goal, like a holiday or an emergency fund. Investment vaults also count toward your early retirement (FIRE) target.',
  '/breakdown':     'See where your money went this month, compared with last month.',
  '/subscriptions': 'List all your subscriptions and mark the ones you hardly use. Cancelling those is the easiest way to save.',
  '/limit':         'Choose to spend only part of what is cleared each day, like 75%, and keep the rest.',
  '/pacing':        'Choose how your spending money is spread across the week: the same every day, or more at the weekend.',
  '/wishlist':      'Add things you want here instead of buying them straight away. Each item shows how many days of spending money it would use up.',
  '/fire':          'See when your investments could pay your living costs for good, also called early retirement or FIRE. Your Investment vaults are counted for you.',
  '/split':         'Split a bill with friends and keep track of who still owes you.',
  '/true-cost':     'See what a purchase really costs in hours of work.',
  '/debt':          'Choose the order you pay off your debts and see the date you will be debt free.',
  '/safety-net':    'See how many months your savings would last if your pay stopped, and how much to aim for.',
  '/income':        'Record pay rises and see how much of your income you need to save to reach your FIRE date.',
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
