// =========================================================================
// Notification system — shared types.
//
// Design rule this whole module exists to enforce: Pocket CFO notifies people
// about THEIR MONEY, never about Pocket CFO. There is no marketing category and
// no "we miss you" copy, because the moment a finance app cries wolf for
// engagement, the user stops trusting the one alert that actually mattered.
//
// Everything here is deliberately serialisable and free of browser APIs, so the
// same types can be evaluated server-side when closed-app push lands. See
// `engine.ts` for the seam.
// =========================================================================

// ── Categories ───────────────────────────────────────────────────────────────
// One category per thing a user would reasonably want to mute on its own.

export type NotificationCategory =
  | 'overspend'     // past today's number, or the number has gone critically low
  | 'bills'         // a bill or subscription lands in the next couple of days
  | 'payday'        // pay arrived and the cycle rolled over
  | 'safe-spend'    // the daily number moved enough to change today's decisions
  | 'daily-review'  // spending logged today has not been reconciled yet
  | 'account';      // sync or account problems (transactional, not a nudge)

// `important` survives the "Important only" mode. `helpful` does not.
export type NotificationLevel = 'important' | 'helpful';

// The three-way master switch shown in Settings.
export type NotificationMode = 'off' | 'important' | 'all';

export interface CategoryMeta {
  label: string;
  description: string;
  level: NotificationLevel;
  // Transactional categories answer a real failure rather than starting a
  // conversation, so they are exempt from the proactive daily/weekly budget.
  // They are still deduped and still respect quiet hours for OS delivery.
  transactional?: boolean;
}

export const CATEGORY_META: Record<NotificationCategory, CategoryMeta> = {
  overspend: {
    label: 'Overspend risk',
    description: "When you pass today's number, when it drops critically low, or when your bills need more than your balance.",
    level: 'important',
  },
  bills: {
    label: 'Bills and subscriptions',
    description: 'When something is due in the next two days and is still unpaid.',
    level: 'important',
  },
  payday: {
    label: 'Payday',
    description: 'When your pay lands and a new cycle starts.',
    level: 'important',
  },
  'safe-spend': {
    label: 'Cleared allowance changes',
    description: 'When your daily number moves enough to matter.',
    level: 'helpful',
  },
  'daily-review': {
    label: 'Daily Review',
    description: 'An evening reminder when you have logged spending but not reviewed it.',
    level: 'helpful',
  },
  account: {
    label: 'Account and sync',
    description: 'If your data stops saving. Sent only when something is actually wrong.',
    level: 'important',
    transactional: true,
  },
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_META) as NotificationCategory[];

// ── Preferences ──────────────────────────────────────────────────────────────

// Tracks whether we have already used up our one chance to ask. Once this is
// anything other than 'unasked', the primer never auto-appears again: a denied
// or dismissed prompt is an answer, not an invitation to ask louder.
export type PrimerState = 'unasked' | 'accepted' | 'dismissed';

export interface QuietHours {
  // Local clock hours, 0-23. A window that wraps midnight is expected and
  // handled (21 -> 8 covers 21:00-23:59 plus 00:00-07:59).
  start: number;
  end: number;
}

export interface NotificationPrefs {
  version: number;
  mode: NotificationMode;
  categories: Record<NotificationCategory, boolean>;
  quietHours: QuietHours;
  primer: PrimerState;
  primerAnsweredAt: string | null;
  updatedAt: string;
}

// ── Records ──────────────────────────────────────────────────────────────────

export type NotificationRuleId =
  | 'overspend-today'
  | 'safe-spend-low'
  | 'bill-due-soon'
  | 'payday-landed'
  | 'safe-spend-shift'
  | 'daily-review-due'
  | 'account-sync-issue'
  | 'test';

export interface NotificationRecord {
  // Unique per emission. Stable for the life of the record so read state,
  // dismissal and (later) server dedupe can all key off it.
  id: string;
  // Identity of the THING being said, not of this particular saying of it.
  // Two emissions sharing a dedupeKey are the same nudge repeated, which is
  // exactly what the cooldown exists to prevent.
  dedupeKey: string;
  ruleId: NotificationRuleId;
  category: NotificationCategory;
  level: NotificationLevel;
  title: string;
  body: string;
  // In-app route the notification should open. Kept as a path rather than a
  // handler so the same record can be delivered by the service worker.
  actionPath?: string;
  createdAt: string;
  readAt: string | null;
  // Whether this record also went out as an OS-level notification. False means
  // it is inbox-only (quiet hours, no permission, or the app was in focus).
  deliveredOs: boolean;
  // 'server' is unused today. It exists so a push-delivered record arriving from
  // the backend can be merged into the same inbox without a schema change.
  origin: 'client' | 'server';
}

// ── Persisted log ────────────────────────────────────────────────────────────

export interface NotificationLogState {
  version: number;
  records: NotificationRecord[];
  // dedupeKey -> ISO timestamp before which this nudge may not be sent again.
  nextEligibleAt: Record<string, string>;
  // Small scratchpad for rules that need to remember what they last told the
  // user (for example the safe-spend figure a change is measured against).
  memory: Record<string, string | number>;
}
