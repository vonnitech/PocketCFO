// =========================================================================
// The notification engine.
//
// One module-level singleton holding prefs and the inbox, with a listener set
// so React can subscribe without prop drilling. Same shape as `lib/pro.ts`,
// which is the existing house pattern for shared non-store state.
//
// A tick is: read a snapshot of the user's finances, ask every rule what is
// true, run the truths through the policy gates, and emit at most one proactive
// record (plus any transactional ones). Ticks are cheap and idempotent, so the
// app can call `tick()` freely; the cooldowns and budget do the restraint.
//
// PUSH READINESS: `evaluate()` below is pure and takes its clock and state as
// arguments. Running the identical selection server-side against a Supabase row
// is the whole job when closed-app push lands; the only new code needed there is
// transport, not policy.
// =========================================================================

import { toLocalDateKey } from '../math';
import type { StoreState } from '../../store/useStore';
import { deliverRecord, permissionState } from './permission';
import {
  budgetUsage,
  cooldownExpiry,
  passesBudget,
  passesStaticGates,
  shouldDeliverToOs,
} from './policy';
import { loadLog, loadPrefs, saveLog, savePrefs, defaultLog, defaultPrefs } from './storage';
import { isSilentMatch, RULES, type NotificationRule, type NotificationStateSlice, type RuleMatch } from './rules';
import { calculateFlatSafeSpend } from '../math';
import {
  CATEGORY_META,
  type NotificationCategory,
  type NotificationLogState,
  type NotificationPrefs,
  type NotificationRecord,
} from './types';

// ── Singleton state ──────────────────────────────────────────────────────────

let prefs: NotificationPrefs = defaultPrefs();
let log: NotificationLogState = defaultLog();
let loadedForUser: string | null = null;

const listeners = new Set<() => void>();
const emitListeners = new Set<(records: NotificationRecord[]) => void>();

function publish(): void {
  listeners.forEach(l => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// Fires only for records created on this tick, so the UI can raise an in-app
// banner without diffing the whole inbox.
export function subscribeToEmissions(listener: (records: NotificationRecord[]) => void): () => void {
  emitListeners.add(listener);
  return () => { emitListeners.delete(listener); };
}

// Storage is user-scoped, so the singleton has to be refilled whenever the
// signed-in user changes. Signing out resets to defaults rather than leaving
// the previous account's inbox in memory.
export function initForUser(userId: string | null): void {
  if (loadedForUser === userId) return;
  loadedForUser = userId;
  if (!userId) {
    prefs = defaultPrefs();
    log = defaultLog();
  } else {
    prefs = loadPrefs(userId);
    log = loadLog(userId);
  }
  publish();
}

export const getPrefs = (): NotificationPrefs => prefs;
export const getLog = (): NotificationLogState => log;
export const getRecords = (): NotificationRecord[] => log.records;
export const getUnreadCount = (): number => log.records.filter(r => !r.readAt).length;

// ── Preference mutations ─────────────────────────────────────────────────────

function commitPrefs(next: NotificationPrefs): void {
  prefs = next;
  savePrefs(prefs, loadedForUser);
  publish();
}

export function setMode(mode: NotificationPrefs['mode']): void {
  commitPrefs({ ...prefs, mode });
}

export function setCategoryEnabled(category: NotificationCategory, enabled: boolean): void {
  commitPrefs({ ...prefs, categories: { ...prefs.categories, [category]: enabled } });
}

export function setQuietHours(start: number, end: number): void {
  commitPrefs({ ...prefs, quietHours: { start, end } });
}

// Records that the one-time onboarding ask has happened. Called for BOTH
// answers: 'accepted' and 'dismissed' both close the question permanently, and
// the primer is never shown unprompted again either way.
export function markPrimerAnswered(answer: 'accepted' | 'dismissed'): void {
  commitPrefs({ ...prefs, primer: answer, primerAnsweredAt: new Date().toISOString() });
}

// ── Inbox mutations ──────────────────────────────────────────────────────────

function commitLog(next: NotificationLogState): void {
  log = saveLog(next, loadedForUser);
  publish();
}

export function markRead(id: string): void {
  const now = new Date().toISOString();
  commitLog({
    ...log,
    records: log.records.map(r => (r.id === id && !r.readAt ? { ...r, readAt: now } : r)),
  });
}

export function markAllRead(): void {
  const now = new Date().toISOString();
  commitLog({
    ...log,
    records: log.records.map(r => (r.readAt ? r : { ...r, readAt: now })),
  });
}

// Clears the visible inbox but deliberately KEEPS nextEligibleAt and memory.
// Emptying a list is not consent to be told the same thing again tomorrow.
export function clearInbox(): void {
  commitLog({ ...log, records: [] });
}

// ── Evaluation ───────────────────────────────────────────────────────────────

export function toStateSlice(state: StoreState): NotificationStateSlice {
  return {
    isConfigured:           state.isConfigured,
    hasCompletedOnboarding: state.hasCompletedOnboarding,
    monthlyTakeHome:        state.monthlyTakeHome,
    safeSpendLimit:         state.safeSpendLimit,
    flatSafeSpendLimit:     calculateFlatSafeSpend(state),
    liquidAssets:           state.liquidAssets,
    upcomingBills:          state.upcomingBills ?? 0,
    nextPayday:             state.nextPayday,
    billQueue:              state.billQueue ?? [],
    subscriptions:          state.subscriptions ?? [],
    transactions:           state.transactions ?? [],
    reconHistory:           state.reconHistory ?? [],
  };
}

interface Candidate {
  rule: NotificationRule;
  match: RuleMatch;
}

export interface EvaluationResult {
  records: NotificationRecord[];
  nextLog: NotificationLogState;
}

// Pure. Every input is explicit so this can be unit tested and, later, run on a
// server with a Supabase-derived state slice and no browser present.
export function evaluate(
  slice: NotificationStateSlice,
  currentPrefs: NotificationPrefs,
  currentLog: NotificationLogState,
  now: Date,
): EvaluationResult {
  const todayKey = toLocalDateKey(now);
  let workingLog = currentLog;

  const ctx = { now, todayKey, state: slice, memory: workingLog.memory };
  const candidates: Candidate[] = [];

  for (const rule of RULES) {
    let match: RuleMatch | null = null;
    try {
      match = rule.evaluate(ctx);
    } catch (e) {
      // A broken rule must never take the app down or block the other rules.
      console.error(`[notifications] rule ${rule.id} threw`, e);
      match = null;
    }
    if (!match) continue;

    // Silent matches say nothing to the user, so they are applied before any
    // consent gate. They exist to keep a rule's baseline honest, and skipping
    // them while notifications are muted would make the first message after
    // unmuting report a change that was never withheld from anyone.
    if (isSilentMatch(match)) {
      if (match.memoryWrites) {
        workingLog = { ...workingLog, memory: { ...workingLog.memory, ...match.memoryWrites } };
      }
      continue;
    }

    candidates.push({ rule, match });
  }

  // Static gates: mode, category, level, cooldown. Budget is handled after
  // ranking, because it is a scarce resource that must go to the best candidate
  // rather than to whichever rule happens to be first in the array.
  const eligible = candidates.filter(c =>
    passesStaticGates(
      { category: c.rule.category, level: CATEGORY_META[c.rule.category].level, dedupeKey: c.match.dedupeKey },
      currentPrefs,
      workingLog,
      now,
    ).allowed,
  );

  const transactional = eligible.filter(c => CATEGORY_META[c.rule.category].transactional);
  const proactive = eligible
    .filter(c => !CATEGORY_META[c.rule.category].transactional)
    .sort((a, b) => b.rule.priority - a.rule.priority);

  const usage = budgetUsage(workingLog, now);
  const chosen: Candidate[] = [...transactional];

  // At most one proactive nudge per tick, and only if the day and week both
  // still have room. Everything else waits; the cooldown was never started, so
  // nothing is lost, it just gets said tomorrow if it is still true.
  const topProactive = proactive[0];
  if (topProactive && passesBudget(topProactive.rule.category, usage).allowed) {
    chosen.push(topProactive);
  }

  const created: NotificationRecord[] = [];
  for (const c of chosen) {
    const record: NotificationRecord = {
      id: crypto.randomUUID(),
      dedupeKey: c.match.dedupeKey,
      ruleId: c.rule.id,
      category: c.rule.category,
      level: CATEGORY_META[c.rule.category].level,
      title: c.match.title,
      body: c.match.body,
      actionPath: c.match.actionPath,
      createdAt: now.toISOString(),
      readAt: null,
      deliveredOs: false,
      origin: 'client',
    };
    created.push(record);

    workingLog = {
      ...workingLog,
      records: [record, ...workingLog.records],
      nextEligibleAt: {
        ...workingLog.nextEligibleAt,
        [c.match.dedupeKey]: cooldownExpiry(now, c.rule.cooldownHours),
      },
      memory: c.match.memoryWrites
        ? { ...workingLog.memory, ...c.match.memoryWrites }
        : workingLog.memory,
    };
  }

  return { records: created, nextLog: workingLog };
}

// ── Tick ─────────────────────────────────────────────────────────────────────

const appFocused = (): boolean => {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'visible' && document.hasFocus();
};

export interface TickResult {
  emitted: NotificationRecord[];
  skipped?: 'not-ready';
}

// Safe to call as often as you like. Returns what was emitted so callers can
// log or test; the UI reacts through subscribeToEmissions instead.
export function tick(state: StoreState, now: Date = new Date()): TickResult {
  // Never notify a half-set-up account, and never act on a cache-hydrated
  // snapshot. `dataFresh` is the store's own guard for "Supabase has confirmed
  // this in THIS session", and notifications follow the same rule that money
  // writes do: stale state can describe a payday that already happened.
  if (!state.userId || !state.dataFresh || !state.isConfigured || !state.hasCompletedOnboarding) {
    return { emitted: [], skipped: 'not-ready' };
  }

  initForUser(state.userId);

  const { records, nextLog } = evaluate(toStateSlice(state), prefs, log, now);

  // Memory and cooldown changes are worth persisting even when nothing was
  // emitted, because silent baseline writes happen on those ticks.
  if (nextLog !== log) commitLog(nextLog);

  // TRUST BOUNDARY. Every downstream channel hangs off `records`, so an empty
  // result here means silence on all three at once: no inbox row (none was
  // constructed), no in-app banner (emitListeners never fires), and no OS
  // notification (deliverAll is never reached).
  //
  // This is what makes notification mode "off" mean off rather than
  // "collected quietly". For a finance app that distinction is a promise, not a
  // detail: opting out must not leave the app still recording a behavioural
  // trail. Moving either line below this return would break that silently, with
  // no type error and no failing rule test, so it is asserted directly in
  // scripts/verify-notifications.ts (section 10).
  //
  // If a passive inbox is ever wanted, it belongs behind its OWN setting, never
  // folded back in under "off".
  if (records.length === 0) return { emitted: [] };

  emitListeners.forEach(l => l(records));

  const canBuzz = shouldDeliverToOs({
    permission: permissionState(),
    appFocused: appFocused(),
    now,
    quietHours: prefs.quietHours,
  });

  if (canBuzz) void deliverAll(records);

  return { emitted: records };
}

// Delivery is fire-and-forget: the record is already in the inbox, so a failed
// buzz costs the user nothing. `deliveredOs` is flipped afterwards so the UI can
// tell an inbox-only item from one that actually reached the device.
async function deliverAll(records: NotificationRecord[]): Promise<void> {
  const delivered: string[] = [];
  for (const r of records) {
    // eslint-disable-next-line no-await-in-loop
    if (await deliverRecord(r)) delivered.push(r.id);
  }
  if (delivered.length === 0) return;
  const ids = new Set(delivered);
  commitLog({
    ...log,
    records: log.records.map(r => (ids.has(r.id) ? { ...r, deliveredOs: true } : r)),
  });
}
