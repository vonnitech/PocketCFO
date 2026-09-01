import { useStore } from '../store/useStore';

// Browser-local storage (localStorage / sessionStorage) is shared across every
// account that signs in on the same device. To stop one user's tool inputs from
// bleeding into another's, we namespace each key with the active user id.
//
// `userKey('pocket-cfo-fire-inputs-v1')` → `pocket-cfo-fire-inputs-v1-<uid>`.
// Falls back to the bare base when signed out (rare; nothing user-specific yet).
export function userKey(base: string): string {
  const uid = useStore.getState().userId;
  return uid ? `${base}-${uid}` : base;
}

// Every browser-local base key that holds per-user tool/state data. The account
// wipe iterates this list so a reset clears local data too — not just cloud rows.
export const USER_LOCAL_BASES = [
  'pocket-cfo-fire-inputs-v1',   // FIRE calculator inputs (sessionStorage)
  'pocket-cfo-tier-lock-v1',     // Recon tier lock
  'pocket-cfo-tier-breaks-v1',   // Recon break count
  'pocket-cfo-tour-v1',          // Feature tour seen flag
  'pocket-cfo-notif-prefs-v1',   // Notification preferences + permission primer state
  'pocket-cfo-notif-log-v1',     // Notification inbox, cooldowns, rule memory
];

// Removes all per-user browser-local data for a given user. Called by the wipe.
export function clearUserLocalData(userId: string): void {
  for (const base of USER_LOCAL_BASES) {
    const k = `${base}-${userId}`;
    try { localStorage.removeItem(k); } catch {}
    try { sessionStorage.removeItem(k); } catch {}
  }
  // Bill-queue cache is already namespaced per user in the store (note: no dash
  // after "pocketcfo"). Clear it here so paid-bill state doesn't survive a wipe.
  try { localStorage.removeItem(`pocketcfo-bill-queue-${userId}`); } catch {}
}
