import { openDB, IDBPDatabase } from 'idb';
import type { AppState } from '../store/useStore';

// ── Local snapshot cache (stale-while-revalidate) ────────────────────────────
// Supabase is the source of truth, but waiting on it blocks the whole app
// (App.tsx renders SyncFallback until dataLoaded). We keep a copy of the last
// known-good state here so a cold start paints instantly and an offline launch
// shows real numbers instead of dropping the user into onboarding.
//
// Snapshots are keyed by userId: two accounts on one device never see each
// other's data, and signing out drops the key entirely.

const DB_NAME    = 'pocket_cfo_cache';
const STORE_NAME = 'snapshots';
const DB_VERSION = 1;

// Bump when the persisted shape changes in a way an old snapshot can't satisfy.
// Mismatched snapshots are dropped rather than migrated — the network refill is
// a second away, so there's nothing worth the migration code.
const SNAPSHOT_VERSION = 1;

// Pagination can grow `transactions` without bound. The cache only has to cover
// the first paint; anything older refills from Supabase on scroll.
const MAX_CACHED_TRANSACTIONS = 500;

// Explicit allow-list rather than "everything except X". Three reasons:
// the store object handed to us also carries its action functions (which are
// not structured-cloneable), the PIN material must never land on disk, and a
// newly added field defaulting to INITIAL_STATE for one paint is a much
// cheaper mistake than one silently getting cached.
//
// NOTE: a new persisted field in AppState needs adding here to survive a reload.
// Deliberately absent:
//   userId, dataLoaded            — set by the hydrate path itself
//   dataFresh                     — must stay false until Supabase confirms, or
//                                   a stale snapshot could re-run the payday credit
//   isLocked, paydayBanner        — transient UI
//   lockEnabled, pinHash, pinSalt — device-local security material, see below
const PERSISTED_KEYS = [
  'allTransactionsLoaded',
  'isConfigured',
  'monthlyTakeHome',
  'fixedBills',
  'monthlySavingsGoal',
  'transactions',
  'subscriptions',
  'vaults',
  'deletedVaults',
  'debts',
  'salary',
  'stats',
  'extraCashPool',
  'dashboardWidgets',
  'impulses',
  'reconHistory',
  'rolloverPool',
  'themeColors',
  'firstName',
  'privacyMode',
  'currency',
  'theme',
  'squad',
  'splitHistory',
  'customSplitPresets',
  'hasCompletedOnboarding',
  'liquidAssets',
  'fixedBurn',
  'safeSpendLimit',
  'primaryVaultBalance',
  'nextPayday',
  'upcomingBills',
  'hardDailyCap',
  'velocityConfig',
  'tierLock',
  'lastSweepDate',
  'billQueue',
  'recurringBills',
  'paidBillKeys',
  'iouLedger',
  'fireConfig',
  'incomeHistory',
] as const satisfies readonly (keyof AppState)[];

export type Snapshot = Partial<AppState>;

interface StoredSnapshot {
  version: number;
  savedAt: number;
  state: Snapshot;
}

async function openCache(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

// Copies only the allow-listed fields, so functions and PIN material can't leak
// in even if the caller hands us the whole store.
function project(state: AppState): Snapshot {
  const out: Record<string, unknown> = {};
  for (const key of PERSISTED_KEYS) {
    const value = (state as unknown as Record<string, unknown>)[key];
    if (value !== undefined) out[key] = value;
  }
  if (Array.isArray(out.transactions) && out.transactions.length > MAX_CACHED_TRANSACTIONS) {
    // `transactions` is held newest-first everywhere in the store.
    out.transactions = out.transactions.slice(0, MAX_CACHED_TRANSACTIONS);
    out.allTransactionsLoaded = false;
  }
  return out as Snapshot;
}

export async function saveSnapshot(userId: string, state: AppState): Promise<void> {
  try {
    const db = await openCache();
    const payload: StoredSnapshot = {
      version: SNAPSHOT_VERSION,
      savedAt: Date.now(),
      state: project(state),
    };
    await db.put(STORE_NAME, payload, userId);
  } catch {
    // A full disk, private browsing, or a blocked IDB just means no fast path.
  }
}

export async function loadSnapshot(userId: string): Promise<Snapshot | null> {
  try {
    const db = await openCache();
    const stored = (await db.get(STORE_NAME, userId)) as StoredSnapshot | undefined;
    if (!stored) return null;
    if (stored.version !== SNAPSHOT_VERSION) {
      await db.delete(STORE_NAME, userId).catch(() => {});
      return null;
    }
    return stored.state ?? null;
  } catch {
    return null;
  }
}

export async function clearSnapshot(userId: string): Promise<void> {
  try {
    const db = await openCache();
    await db.delete(STORE_NAME, userId);
  } catch { /* nothing to clear */ }
}

// ── Debounced writes ─────────────────────────────────────────────────────────
// Every store mutation is a candidate save, so writes are coalesced the same way
// core/sync.ts coalesces Supabase updates. Only the latest state matters.

const SAVE_DEBOUNCE_MS = 1500;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: AppState | null = null;

export function queueSnapshotSave(state: AppState): void {
  // Nothing worth caching until a real load has populated the store; saving
  // INITIAL_STATE here would overwrite a good snapshot with a blank one.
  if (!state.userId || !state.dataLoaded) return;
  pendingState = state;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const snapshot = pendingState;
    pendingState = null;
    if (snapshot?.userId) void saveSnapshot(snapshot.userId, snapshot);
  }, SAVE_DEBOUNCE_MS);
}

// Drops any queued write. Used on sign-out so an in-flight save can't resurrect
// the snapshot we just deleted.
export function cancelQueuedSnapshotSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  pendingState = null;
}
