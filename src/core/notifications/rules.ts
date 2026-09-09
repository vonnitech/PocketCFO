// =========================================================================
// Notification rules.
//
// Each rule is a pure function from a snapshot of the user's finances to zero
// or one thing worth saying. Rules never decide whether to SEND; they only
// decide whether something is TRUE. Sending is `policy.ts`, and keeping those
// two apart is what stops "is this worth interrupting someone for" logic from
// scattering across the app.
//
// Two conventions every rule follows:
//   1. Suppression is structural. A rule about an unfinished action reads the
//      state that proves it is unfinished, so completing the action silences
//      the rule automatically rather than through a separate mute flag.
//   2. Copy is factual and second-person. It states a number and what changed.
//      No shame, no urgency theatre, no streaks to protect.
// =========================================================================

import { billKey, calculateDailyDrain, toLocalDateKey } from '../math';
import {
  assessRisk,
  decideEscalation,
  recoveryMemory,
  writeRiskMemory,
  RISK,
  type RiskAssessment,
} from './risk';
// Types only. This module must not pull the Zustand store (and through it
// Supabase) into its graph, because the same rules are meant to run server-side
// against a database row when closed-app push lands.
import type { BillQueueItem, Subscription, Transaction, ReconEntry } from '../../store/useStore';
import { formatCurrency } from '../../lib/utils';
import { readSyncHealth } from './health';
import type { NotificationCategory, NotificationRuleId } from './types';
import { CATEGORY_META } from './types';

// ── Context ──────────────────────────────────────────────────────────────────

// A narrow, read-only view of the store. Deliberately not `AppState`: rules
// should only be able to see what they are allowed to reason about, and this
// shape is small enough to reconstruct from a server-side row later.
export interface NotificationStateSlice {
  isConfigured: boolean;
  hasCompletedOnboarding: boolean;
  monthlyTakeHome: number;
  // Today's allowance AFTER Velocity reshapes it. Correct for "did you overspend
  // today", wrong for "is your position dangerous".
  safeSpendLimit: number;
  // The unshaped figure, before pacing. A weekday trimmed to fund the weekend is
  // a deliberate reallocation, not a loss of capacity, so capacity questions must
  // be asked against this.
  flatSafeSpendLimit: number;
  liquidAssets: number;
  // Bills and subscriptions already reserved before payday. Needed because
  // calculateRawSafeSpend clamps at 0, which hides whether a £0 daily number
  // means "break even" or "£400 short on rent".
  upcomingBills: number;
  nextPayday: string;
  billQueue: BillQueueItem[];
  subscriptions: Subscription[];
  transactions: Transaction[];
  reconHistory: ReconEntry[];
}

export interface RuleContext {
  now: Date;
  todayKey: string;
  state: NotificationStateSlice;
  memory: Record<string, string | number>;
}

export interface RuleMatch {
  dedupeKey: string;
  title: string;
  body: string;
  actionPath?: string;
  // Written to `memory` if and only if this match is actually emitted, so a
  // rule measures change against what the user was last TOLD, not against
  // whatever the value happened to be on the last tick.
  memoryWrites?: Record<string, string | number>;
}

export interface NotificationRule {
  id: NotificationRuleId;
  category: NotificationCategory;
  // Only one proactive nudge can go out per day, so when several are true at
  // once the highest priority wins and the rest wait their turn.
  priority: number;
  cooldownHours: number;
  evaluate: (ctx: RuleContext) => RuleMatch | null;
}

// ── Shared helpers ───────────────────────────────────────────────────────────

const money = (n: number) => formatCurrency(n, false);

const txOnDay = (transactions: Transaction[], dayKey: string): Transaction[] =>
  transactions.filter(tx => toLocalDateKey(tx.date) === dayKey);

const isPaydayTx = (tx: Transaction): boolean =>
  tx.category === 'INCOME' && tx.merchant === 'PAYDAY';

const reviewedOn = (reconHistory: ReconEntry[], dayKey: string): boolean =>
  reconHistory.some(e => toLocalDateKey(e.date) === dayKey);

const dayKeyOffset = (from: Date, days: number): string =>
  toLocalDateKey(new Date(from.getFullYear(), from.getMonth(), from.getDate() + days));

// A bill carries a day-of-month, not a date. Resolve it to the next occurrence
// on or after today so "due in 2 days" means the same thing at month boundaries.
function nextOccurrence(dueDay: number, from: Date): Date | null {
  if (!dueDay || dueDay < 1 || dueDay > 31) return null;
  const y = from.getFullYear();
  const m = from.getMonth();
  const clampToMonth = (year: number, month: number): Date => {
    const last = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(dueDay, last));
  };
  const thisMonth = clampToMonth(y, m);
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return thisMonth >= today ? thisMonth : clampToMonth(y, m + 1);
}

const daysBetween = (a: Date, b: Date): number =>
  Math.round(
    (new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() -
     new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / 86400000,
  );

// How many days out counts as "due soon".
const DUE_SOON_DAYS = 2;

// ── Rules ────────────────────────────────────────────────────────────────────

// ── Overspend risk ───────────────────────────────────────────────────────────
//
// These two rules share one risk model (risk.ts) and are mutually exclusive by
// construction: `overspend-today` owns the case where the user has gone past
// today's number, `safe-spend-low` owns everything else. That guarantees the
// same trouble is never reported twice in different words.
//
// Both are SEVERITY-throttled rather than time-throttled. The 48h cooldown still
// applies to an unchanged situation, but a genuine worsening emits under a fresh
// identity that the cooldown has never seen. The global 1/day and 3/week caps and
// quiet hours are untouched and still bound everything.

// Shared copy for the structural case, used by whichever rule is reporting it.
const shortfallLine = (a: RiskAssessment) =>
  `${money(a.shortfall)} more in bills than you have before payday.`;

// Frames a repeat as new information rather than a repeated complaint. Only used
// when the figure has actually moved since the last warning.
const worseningLine = (current: number, previous: number) =>
  previous > 0 && current > previous ? ` Up from ${money(previous)} when we last flagged it.` : '';

const overspendToday: NotificationRule = {
  id: 'overspend-today',
  category: 'overspend',
  priority: 100,
  cooldownHours: 48,
  evaluate: ({ state, todayKey, now, memory }) => {
    const a = assessRisk(state, now);

    // Not over today. Record the recovery so a later relapse reads as a new
    // episode rather than as the same one still running.
    if (!a.overspentToday) {
      return {
        dedupeKey: 'overspend-today:recovered',
        title: '',
        body: '',
        memoryWrites: recoveryMemory('overspend-today', todayKey),
      };
    }

    const esc = decideEscalation('overspend-today', a, todayKey, memory);
    const last = Number(memory['risk:overspend-today:overshoot']) || 0;

    // The structural problem is the more serious one, so it leads when present.
    const body = a.level === RISK.SHORTFALL
      ? `${money(a.overshoot)} past today's number, and there is ${shortfallLine(a)}`
      : `${money(a.overshoot)} past today's number.${worseningLine(a.overshoot, esc.escalated ? last : 0)} It comes out of the days before payday.`;

    return {
      dedupeKey: esc.dedupeKey,
      title: "You are past today's number",
      body,
      actionPath: '/recon',
      memoryWrites: writeRiskMemory('overspend-today', {
        level: a.level, step: a.step, day: todayKey, overshoot: a.overshoot,
        lastKey: esc.dedupeKey,
      }),
    };
  },
};

// Everything that is not "you spent too much today": a daily number that has
// gone critically thin, and the case the dashboard cannot show at all, where
// committed bills exceed the cash available before payday.
const safeSpendLow: NotificationRule = {
  id: 'safe-spend-low',
  category: 'overspend',
  priority: 90,
  cooldownHours: 48,
  evaluate: ({ state, todayKey, now, memory }) => {
    const a = assessRisk(state, now);

    // Ceded to overspend-today, or nothing wrong. Either way, record safety.
    if (a.overspentToday || a.level < RISK.CRITICAL) {
      return {
        dedupeKey: 'safe-spend-low:recovered',
        title: '',
        body: '',
        memoryWrites: recoveryMemory('safe-spend-low', todayKey),
      };
    }

    const esc = decideEscalation('safe-spend-low', a, todayKey, memory);
    const lastShortfall = Number(memory['risk:safe-spend-low:overshoot']) || 0;

    const shortfallCase = a.level === RISK.SHORTFALL;
    const days = a.daysToPayday;

    return {
      dedupeKey: esc.dedupeKey,
      title: shortfallCase
        ? 'Your bills need more than your balance'
        : 'Your daily number is running thin',
      body: shortfallCase
        ? `You have ${shortfallLine(a)}${worseningLine(a.shortfall, esc.escalated ? lastShortfall : 0)} Moving a bill or topping up closes the gap.`
        : `${money(state.safeSpendLimit)} a day with ${days} day${days === 1 ? '' : 's'} to payday, after bills are held back.`,
      actionPath: '/',
      memoryWrites: writeRiskMemory('safe-spend-low', {
        level: a.level,
        step: a.step,
        day: todayKey,
        // Shortfall is the figure this rule reports, so it is what a later
        // "up from" comparison has to be made against.
        overshoot: shortfallCase ? a.shortfall : 0,
        lastKey: esc.dedupeKey,
      }),
    };
  },
};

// Bills are aggregated into one message rather than one each. Two bills landing
// the same week should cost one notification, not two days of budget.
const billDueSoon: NotificationRule = {
  id: 'bill-due-soon',
  category: 'bills',
  priority: 80,
  cooldownHours: 48,
  evaluate: ({ state, now }) => {
    // `billQueue` is already (template minus paid-this-cycle), so a bill the
    // user has ticked off cannot appear here. That is the suppression.
    const dueBills = state.billQueue
      .map(b => ({ bill: b, on: b.dueDay ? nextOccurrence(b.dueDay, now) : null }))
      .filter((x): x is { bill: BillQueueItem; on: Date } => x.on !== null)
      .filter(x => daysBetween(now, x.on) <= DUE_SOON_DAYS);

    const dueSubs = state.subscriptions
      .filter(s => !!s.nextBillingDate)
      .map(s => ({ sub: s, on: new Date(`${(s.nextBillingDate as string).slice(0, 10)}T00:00:00`) }))
      .filter(x => !Number.isNaN(x.on.getTime()))
      .filter(x => {
        const d = daysBetween(now, x.on);
        return d >= 0 && d <= DUE_SOON_DAYS;
      });

    const count = dueBills.length + dueSubs.length;
    if (count === 0) return null;

    const total =
      dueBills.reduce((s, x) => s + (Number(x.bill.amount) || 0), 0) +
      dueSubs.reduce((s, x) => s + (Number(x.sub.amount) || 0), 0);

    const soonest = Math.min(
      ...dueBills.map(x => daysBetween(now, x.on)),
      ...dueSubs.map(x => daysBetween(now, x.on)),
    );
    const when = soonest <= 0 ? 'today' : soonest === 1 ? 'tomorrow' : `in ${soonest} days`;

    // Keyed on the identity of what is due, so a different bill next week is a
    // different nudge, but the same bill nagging twice is not.
    const identity = [
      ...dueBills.map(x => billKey(x.bill)),
      ...dueSubs.map(x => `sub:${x.sub.id}`),
    ].sort().join('|');

    const name = count === 1
      ? (dueBills[0]?.bill.name ?? dueSubs[0]?.sub.name ?? 'A bill')
      : `${count} bills`;

    return {
      dedupeKey: `bill-due:${identity}`,
      title: count === 1 ? `${name} is due ${when}` : `${count} bills due ${when}`,
      body: `${money(total)} due ${when}. It is already held back from your daily number.`,
      actionPath: '/',
    };
  },
};

// Fires on the day the cycle rolls. Today this mostly lands in the inbox, since
// the app has to be open to notice. It is the first thing closed-app push will
// light up, which is why it is written to be useful hours after the fact.
const paydayLanded: NotificationRule = {
  id: 'payday-landed',
  category: 'payday',
  priority: 75,
  cooldownHours: 48,
  evaluate: ({ state, todayKey }) => {
    const paydayToday = txOnDay(state.transactions, todayKey).filter(isPaydayTx);
    if (paydayToday.length === 0) return null;
    const credited = paydayToday.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return {
      // Scoped to the cycle it opened, so next month is a new nudge.
      dedupeKey: `payday-landed:${todayKey}`,
      title: 'Your pay landed',
      body: `${money(credited)} added. Your new daily number is ${money(state.safeSpendLimit)}.`,
      actionPath: '/vaults',
    };
  },
};

// How far the daily number has to move before it is worth an interruption.
const SAFE_SPEND_SHIFT_RATIO = 0.25;
export const SAFE_SPEND_MEMORY_KEY = 'safe-spend:last-notified';

// Used for the silent baseline writes below. A match with this key never
// produces a record; see `isSilentMatch`.
const SILENT_SEED_KEY = 'safe-spend-shift:seed';

const seedSafeSpend = (current: number): RuleMatch => ({
  dedupeKey: SILENT_SEED_KEY,
  title: '',
  body: '',
  memoryWrites: { [SAFE_SPEND_MEMORY_KEY]: current },
});

const safeSpendShift: NotificationRule = {
  id: 'safe-spend-shift',
  category: 'safe-spend',
  priority: 50,
  cooldownHours: 48,
  evaluate: ({ state, memory, todayKey, now }) => {
    const current = state.safeSpendLimit;
    if (current <= 0) return null;

    const previous = Number(memory[SAFE_SPEND_MEMORY_KEY]);
    // First sighting: record the baseline silently. A brand new user should
    // never be told their number "changed" from nothing.
    if (!Number.isFinite(previous) || previous <= 0) return seedSafeSpend(current);

    // Payday always moves this number hard, and the payday rule already covers
    // it. Reporting both would be the same news twice.
    const paydayRecently =
      txOnDay(state.transactions, todayKey).some(isPaydayTx) ||
      txOnDay(state.transactions, dayKeyOffset(now, -1)).some(isPaydayTx);
    if (paydayRecently) return seedSafeSpend(current);

    const delta = current - previous;
    if (Math.abs(delta) / previous < SAFE_SPEND_SHIFT_RATIO) return null;

    const up = delta > 0;
    return {
      dedupeKey: 'safe-spend-shift',
      title: up ? 'Your daily number went up' : 'Your daily number went down',
      body: `${money(previous)} to ${money(current)} a day${up ? '.' : ', after bills and savings are held back.'}`,
      actionPath: '/',
      memoryWrites: { [SAFE_SPEND_MEMORY_KEY]: current },
    };
  },
};

// Evening only, and only when there is genuinely something to reconcile.
const DAILY_REVIEW_HOUR = 18;

const dailyReviewDue: NotificationRule = {
  id: 'daily-review-due',
  category: 'daily-review',
  priority: 40,
  cooldownHours: 48,
  evaluate: ({ state, todayKey, now }) => {
    if (now.getHours() < DAILY_REVIEW_HOUR) return null;
    // Already reviewed today. Structural suppression, no separate flag.
    if (reviewedOn(state.reconHistory, todayKey)) return null;
    const spendToday = txOnDay(state.transactions, todayKey).filter(tx => !isPaydayTx(tx));
    if (spendToday.length === 0) return null;
    const drain = calculateDailyDrain(spendToday);
    if (drain <= 0) return null;
    return {
      dedupeKey: 'daily-review-due',
      title: 'Daily Review is open',
      body: `${money(drain)} logged today. Reviewing it rolls whatever is left into tomorrow.`,
      actionPath: '/recon',
    };
  },
};

// Transactional. Exempt from the daily and weekly budget because it reports a
// real failure rather than starting a conversation, and a user whose data is
// not saving needs to know that regardless of how chatty the week has been.
const accountSyncIssue: NotificationRule = {
  id: 'account-sync-issue',
  category: 'account',
  priority: 95,
  cooldownHours: 12,
  evaluate: ({ now }) => {
    const health = readSyncHealth(now.getTime());
    if (!health.failing) return null;
    return {
      dedupeKey: 'account-sync',
      title: 'Some changes have not saved',
      body: 'Pocket CFO could not reach the server on your last few changes. They are safe on this device and will sync when the connection is back.',
      actionPath: '/settings',
    };
  },
};

// Ordered by priority for readability. The engine re-sorts, so this is only a
// convention.
export const RULES: NotificationRule[] = [
  overspendToday,
  accountSyncIssue,
  safeSpendLow,
  billDueSoon,
  paydayLanded,
  safeSpendShift,
  dailyReviewDue,
];

// A match with no title is a memory write only: the rule wants to remember
// something without saying anything. `safe-spend-shift` uses this to seed its
// baseline. Kept explicit so the engine never emits an empty record.
export const isSilentMatch = (m: RuleMatch): boolean => m.title.trim().length === 0;

export const ruleLevel = (rule: NotificationRule) => CATEGORY_META[rule.category].level;
