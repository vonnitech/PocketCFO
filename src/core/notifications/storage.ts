// =========================================================================
// Notification persistence.
//
// localStorage today, scoped by user id so two accounts on one device never see
// each other's inbox. Both base keys are registered in USER_LOCAL_BASES, so an
// account wipe clears them along with everything else.
//
// THE SERVER SEAM: every read and write in the rest of the module goes through
// the four functions at the bottom of this file. When closed-app push lands,
// swap their bodies for Supabase reads/writes (or read-through cache) and
// nothing else in the notification system has to change. That is the entire
// reason prefs and log are plain JSON with a `version` field.
// =========================================================================

import { DEFAULT_QUIET_HOURS } from './policy';
import {
  ALL_CATEGORIES,
  type NotificationCategory,
  type NotificationLogState,
  type NotificationPrefs,
} from './types';

export const PREFS_BASE_KEY = 'pocket-cfo-notif-prefs-v1';
export const LOG_BASE_KEY   = 'pocket-cfo-notif-log-v1';

// Same `base-uid` convention as lib/userScopedStorage, but the id is passed in
// rather than read from the store. That keeps this module (and everything above
// it) free of a Zustand import, which is what lets the rules and policy run
// outside a browser. The bases are registered in USER_LOCAL_BASES so the account
// wipe still clears them.
const scopedKey = (base: string, userId: string | null): string =>
  userId ? `${base}-${userId}` : base;

const PREFS_VERSION = 1;
const LOG_VERSION   = 1;

// The inbox is a recent-history view, not an archive. Older records are dropped
// on write so a long-lived account cannot grow this without bound.
const MAX_RECORDS = 60;

// Cooldown entries are only useful until they expire. Anything this old is
// certainly spent and is pruned to keep the blob small.
const COOLDOWN_RETENTION_DAYS = 30;

// ── Defaults ─────────────────────────────────────────────────────────────────

// Everything on, but the master mode starts at 'important'. A finance app that
// opts you into its chattiest setting has already lost the argument about
// whether it respects your attention. "Helpful reminders" is one tap away.
export function defaultPrefs(): NotificationPrefs {
  const categories = {} as Record<NotificationCategory, boolean>;
  for (const c of ALL_CATEGORIES) categories[c] = true;
  return {
    version: PREFS_VERSION,
    mode: 'important',
    categories,
    quietHours: { ...DEFAULT_QUIET_HOURS },
    primer: 'unasked',
    primerAnsweredAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function defaultLog(): NotificationLogState {
  return { version: LOG_VERSION, records: [], nextEligibleAt: {}, memory: {} };
}

// ── Parsing ──────────────────────────────────────────────────────────────────
//
// Both parsers are total: anything unreadable becomes the default rather than
// throwing. A corrupted inbox must never be able to stop the app from booting.

function parsePrefs(raw: string | null): NotificationPrefs {
  if (!raw) return defaultPrefs();
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    if (!parsed || typeof parsed !== 'object') return defaultPrefs();
    if (parsed.version !== PREFS_VERSION) return defaultPrefs();

    const base = defaultPrefs();
    const categories = { ...base.categories };
    if (parsed.categories && typeof parsed.categories === 'object') {
      for (const c of ALL_CATEGORIES) {
        const v = (parsed.categories as Record<string, unknown>)[c];
        if (typeof v === 'boolean') categories[c] = v;
      }
    }

    const mode = parsed.mode === 'off' || parsed.mode === 'important' || parsed.mode === 'all'
      ? parsed.mode
      : base.mode;

    const primer = parsed.primer === 'accepted' || parsed.primer === 'dismissed'
      ? parsed.primer
      : 'unasked';

    const qh = parsed.quietHours;
    const validHour = (h: unknown): h is number =>
      typeof h === 'number' && Number.isInteger(h) && h >= 0 && h <= 23;
    const quietHours = qh && validHour(qh.start) && validHour(qh.end)
      ? { start: qh.start, end: qh.end }
      : { ...base.quietHours };

    return {
      version: PREFS_VERSION,
      mode,
      categories,
      quietHours,
      primer,
      primerAnsweredAt: typeof parsed.primerAnsweredAt === 'string' ? parsed.primerAnsweredAt : null,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : base.updatedAt,
    };
  } catch {
    return defaultPrefs();
  }
}

function parseLog(raw: string | null): NotificationLogState {
  if (!raw) return defaultLog();
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationLogState>;
    if (!parsed || typeof parsed !== 'object') return defaultLog();
    if (parsed.version !== LOG_VERSION) return defaultLog();
    return {
      version: LOG_VERSION,
      records: Array.isArray(parsed.records) ? parsed.records : [],
      nextEligibleAt:
        parsed.nextEligibleAt && typeof parsed.nextEligibleAt === 'object'
          ? (parsed.nextEligibleAt as Record<string, string>)
          : {},
      memory:
        parsed.memory && typeof parsed.memory === 'object'
          ? (parsed.memory as Record<string, string | number>)
          : {},
    };
  } catch {
    return defaultLog();
  }
}

// ── Pruning ──────────────────────────────────────────────────────────────────

function prune(log: NotificationLogState, now: Date): NotificationLogState {
  const records = [...log.records]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, MAX_RECORDS);

  const floor = now.getTime() - COOLDOWN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const nextEligibleAt: Record<string, string> = {};
  for (const [key, iso] of Object.entries(log.nextEligibleAt)) {
    const ts = Date.parse(iso);
    if (Number.isFinite(ts) && ts >= floor) nextEligibleAt[key] = iso;
  }

  return { ...log, records, nextEligibleAt };
}

// ── The seam ─────────────────────────────────────────────────────────────────
// Replace these four bodies to move persistence to the server. Nothing above
// this line and nothing outside this file needs to know where the bytes live.

export function loadPrefs(userId: string | null): NotificationPrefs {
  try {
    return parsePrefs(localStorage.getItem(scopedKey(PREFS_BASE_KEY, userId)));
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(prefs: NotificationPrefs, userId: string | null): void {
  try {
    const next = { ...prefs, version: PREFS_VERSION, updatedAt: new Date().toISOString() };
    localStorage.setItem(scopedKey(PREFS_BASE_KEY, userId), JSON.stringify(next));
  } catch {
    // Private-mode or quota failure. Preferences degrade to session-only, which
    // is strictly better than throwing inside a settings toggle.
  }
}

export function loadLog(userId: string | null): NotificationLogState {
  try {
    return parseLog(localStorage.getItem(scopedKey(LOG_BASE_KEY, userId)));
  } catch {
    return defaultLog();
  }
}

export function saveLog(
  log: NotificationLogState,
  userId: string | null,
  now: Date = new Date(),
): NotificationLogState {
  const pruned = prune(log, now);
  try {
    localStorage.setItem(scopedKey(LOG_BASE_KEY, userId), JSON.stringify(pruned));
  } catch {
    // Same reasoning as savePrefs. Worst case the budget resets on reload,
    // which errs toward under-notifying rather than over-notifying.
  }
  return pruned;
}
