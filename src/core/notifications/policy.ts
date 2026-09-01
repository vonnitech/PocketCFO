// =========================================================================
// The anti-bombardment engine.
//
// Every gate that can stop a notification lives here, in one place, as pure
// functions over plain data. Nothing in this file touches the browser, the
// store, or the clock directly, which is what makes the whole policy testable
// and reusable server-side when closed-app push lands.
//
// The budget is deliberately brutal: at most ONE proactive nudge a day and
// THREE a week, across every category combined. That is the number that keeps
// an alert meaningful. Rules therefore compete rather than queue, and the
// highest-priority eligible candidate is the one that gets spent.
// =========================================================================

import {
  CATEGORY_META,
  type NotificationCategory,
  type NotificationLevel,
  type NotificationLogState,
  type NotificationPrefs,
  type NotificationRecord,
  type QuietHours,
} from './types';

export const POLICY = {
  // Proactive nudges only. Transactional categories (see CATEGORY_META) are
  // exempt because they report a real failure rather than start a conversation.
  maxPerDay: 1,
  maxPerWeek: 3,
  weekWindowDays: 7,
  // How long the same dedupeKey is barred from repeating. Rules may extend this
  // but never shorten it below the floor.
  defaultCooldownHours: 48,
  minCooldownHours: 12,
} as const;

export const DEFAULT_QUIET_HOURS: QuietHours = { start: 21, end: 8 };

// ── Quiet hours ──────────────────────────────────────────────────────────────

// Windows that wrap midnight are the normal case here, so the wrap is handled
// explicitly rather than assuming start < end.
export function isQuietHour(at: Date, quiet: QuietHours = DEFAULT_QUIET_HOURS): boolean {
  const hour = at.getHours();
  const { start, end } = quiet;
  if (start === end) return false;
  return start < end
    ? hour >= start && hour < end
    : hour >= start || hour < end;
}

// ── Mode / category gates ────────────────────────────────────────────────────

export function levelAllowedByMode(level: NotificationLevel, prefs: NotificationPrefs): boolean {
  if (prefs.mode === 'off') return false;
  if (prefs.mode === 'important') return level === 'important';
  return true;
}

export function categoryEnabled(category: NotificationCategory, prefs: NotificationPrefs): boolean {
  return prefs.categories[category] !== false;
}

// ── Budget accounting ────────────────────────────────────────────────────────

const DAY_MS  = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const isTransactional = (category: NotificationCategory): boolean =>
  CATEGORY_META[category].transactional === true;

// Only proactive records count. A record whose category is transactional never
// consumes budget and never blocks a nudge that would have gone out anyway.
function proactiveRecordsSince(records: NotificationRecord[], since: number): NotificationRecord[] {
  return records.filter(r =>
    !isTransactional(r.category) &&
    Date.parse(r.createdAt) >= since,
  );
}

export interface BudgetUsage {
  today: number;
  week: number;
  dayRemaining: number;
  weekRemaining: number;
}

export function budgetUsage(log: NotificationLogState, now: Date): BudgetUsage {
  // "Today" is the local calendar day, not a rolling 24h window. A nudge at
  // 11pm should not silence the whole of the next morning.
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart  = now.getTime() - POLICY.weekWindowDays * DAY_MS;

  const today = proactiveRecordsSince(log.records, startOfDay).length;
  const week  = proactiveRecordsSince(log.records, weekStart).length;

  return {
    today,
    week,
    dayRemaining:  Math.max(0, POLICY.maxPerDay  - today),
    weekRemaining: Math.max(0, POLICY.maxPerWeek - week),
  };
}

// ── Cooldown ─────────────────────────────────────────────────────────────────

export function isOnCooldown(dedupeKey: string, log: NotificationLogState, now: Date): boolean {
  const until = log.nextEligibleAt[dedupeKey];
  if (!until) return false;
  const ts = Date.parse(until);
  return Number.isFinite(ts) && ts > now.getTime();
}

export function cooldownExpiry(now: Date, hours: number): string {
  const clamped = Math.max(POLICY.minCooldownHours, hours || POLICY.defaultCooldownHours);
  return new Date(now.getTime() + clamped * HOUR_MS).toISOString();
}

// ── The decision ─────────────────────────────────────────────────────────────

export type BlockReason =
  | 'mode-off'
  | 'category-off'
  | 'level-filtered'
  | 'cooldown'
  | 'daily-cap'
  | 'weekly-cap';

export interface Verdict {
  allowed: boolean;
  reason?: BlockReason;
}

// Everything except the budget. Split out because budget is a scarce shared
// resource that has to be spent on the best candidate, which means candidates
// must first be filtered and ranked without consuming it.
export function passesStaticGates(
  candidate: { category: NotificationCategory; level: NotificationLevel; dedupeKey: string },
  prefs: NotificationPrefs,
  log: NotificationLogState,
  now: Date,
): Verdict {
  if (prefs.mode === 'off')                                 return { allowed: false, reason: 'mode-off' };
  if (!categoryEnabled(candidate.category, prefs))          return { allowed: false, reason: 'category-off' };
  if (!levelAllowedByMode(candidate.level, prefs))          return { allowed: false, reason: 'level-filtered' };
  if (isOnCooldown(candidate.dedupeKey, log, now))          return { allowed: false, reason: 'cooldown' };
  return { allowed: true };
}

export function passesBudget(
  category: NotificationCategory,
  usage: BudgetUsage,
): Verdict {
  if (isTransactional(category)) return { allowed: true };
  if (usage.dayRemaining  <= 0)  return { allowed: false, reason: 'daily-cap' };
  if (usage.weekRemaining <= 0)  return { allowed: false, reason: 'weekly-cap' };
  return { allowed: true };
}

// ── OS delivery ──────────────────────────────────────────────────────────────

export interface OsDeliveryContext {
  permission: 'granted' | 'denied' | 'default' | 'unsupported';
  appFocused: boolean;
  now: Date;
  quietHours: QuietHours;
}

// Whether a record that has already been allowed into the inbox should ALSO
// buzz the device. Three separate reasons it should not:
//   - no permission, obviously
//   - quiet hours, so we never wake anyone over a bill
//   - the app is in the foreground, because buzzing someone who is already
//     looking at the screen is pure noise; they get the in-app banner instead
export function shouldDeliverToOs(ctx: OsDeliveryContext): boolean {
  if (ctx.permission !== 'granted') return false;
  if (ctx.appFocused) return false;
  if (isQuietHour(ctx.now, ctx.quietHours)) return false;
  return true;
}
