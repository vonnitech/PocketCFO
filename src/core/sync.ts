import { supabase } from './supabase';

// ── Debounced sync infrastructure ────────────────────────────────────────────
// Profile and vault updates are idempotent — only the latest payload per record
// matters. We batch rapid-fire updates by merging payloads and only firing the
// network request once the user stops clicking for DEBOUNCE_MS.

const DEBOUNCE_MS = 1500;

interface PendingUpdate {
  payload: Record<string, unknown>;
  timer: ReturnType<typeof setTimeout>;
}

const pendingProfileUpdates = new Map<string, PendingUpdate>();
const pendingVaultUpdates   = new Map<string, PendingUpdate>();

function scheduleDebounced(
  bucket: Map<string, PendingUpdate>,
  key: string,
  payload: Record<string, unknown>,
  flush: (merged: Record<string, unknown>) => Promise<void>,
): void {
  const existing = bucket.get(key);
  const mergedPayload = { ...(existing?.payload ?? {}), ...payload };
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    const finalPayload = bucket.get(key)?.payload ?? mergedPayload;
    bucket.delete(key);
    flush(finalPayload).catch(() => {});
  }, DEBOUNCE_MS);
  bucket.set(key, { payload: mergedPayload, timer });
}

// Force any pending updates to fire immediately (e.g., on logout / page unload).
export function flushPendingSyncs(): void {
  for (const [userId, entry] of pendingProfileUpdates.entries()) {
    clearTimeout(entry.timer);
    pendingProfileUpdates.delete(userId);
    (supabase.from('profiles') as any).update(entry.payload).eq('id', userId).then(() => {}, () => {});
  }
  for (const [vaultId, entry] of pendingVaultUpdates.entries()) {
    clearTimeout(entry.timer);
    pendingVaultUpdates.delete(vaultId);
    (supabase.from('vaults') as any).update(entry.payload).eq('id', vaultId).then(() => {}, () => {});
  }
}

// Best-effort: flush pending updates when the tab closes so we don't lose work.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPendingSyncs);
}

// ── Public API ───────────────────────────────────────────────────────────────

// Inserts are NOT debounced — each call is a unique row and merging would lose data.
export async function pushTransactions(rows: Record<string, unknown>[]): Promise<void> {
  if (!rows.length) return;
  try {
    await (supabase.from('transactions') as any).insert(rows);
  } catch { /* silently fail */ }
}

// Profile updates are debounced per-user. Rapid toggles (paying bills one after
// another, editing fields, dragging sliders) collapse into a single network call.
export async function pushProfileUpdate(userId: string, payload: Record<string, unknown>): Promise<void> {
  scheduleDebounced(pendingProfileUpdates, userId, payload, async (merged) => {
    await (supabase.from('profiles') as any).update(merged).eq('id', userId);
  });
}

// Vault updates are debounced per-vault. Rapid balance adjustments collapse.
export async function pushVaultUpdate(vaultId: string, payload: Record<string, unknown>): Promise<void> {
  scheduleDebounced(pendingVaultUpdates, vaultId, payload, async (merged) => {
    await (supabase.from('vaults') as any).update(merged).eq('id', vaultId);
  });
}

export async function pushVaultInsert(userId: string, row: Record<string, unknown>): Promise<void> {
  try {
    await (supabase.from('vaults') as any).insert({ ...row, user_id: userId });
  } catch { /* silently fail */ }
}

export async function pushReconEntry(userId: string, row: Record<string, unknown>): Promise<void> {
  try {
    await (supabase.from('recon_history') as any).insert({ ...row, user_id: userId });
  } catch { /* silently fail */ }
}
