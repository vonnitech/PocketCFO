// Free-tier vault rules, in one place so the page, the store and the database
// migration all describe the same policy.

export const FREE_VAULT_CAP = 3;

interface VaultLike {
  id: string;
  created_at?: string | null;
}

// Oldest first, id as the tiebreaker.
//
// `created_at` arrived in migration 018, which backfilled every existing row with
// the same timestamp because the real creation order was never recorded. Sorting
// on the timestamp alone would therefore leave those rows in an arbitrary,
// shifting order. Falling back to id keeps the result stable across sessions,
// which matters because this ordering decides which vaults a lapsed account keeps
// full use of.
export const sortVaultsByAge = <T extends VaultLike>(vaults: T[]): T[] =>
  [...(vaults || [])].sort((a, b) => {
    const at = a.created_at ?? '';
    const bt = b.created_at ?? '';
    if (at !== bt) return at < bt ? -1 : 1;
    return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
  });

// Vaults a lapsed free account can no longer pay INTO.
//
// The policy, deliberately: when Pro ends on an account holding more than the
// free cap, nothing is hidden and nothing is confiscated. The oldest
// FREE_VAULT_CAP vaults stay fully usable. The rest stay visible with their
// balances, and money can still be moved OUT of them and they can still be
// deleted, so the account always has a route back under the cap under its own
// steam. Only new deposits into those vaults are blocked. Locking someone out of
// their own savings would be the wrong trade for protecting a subscription.
export const lockedVaultIds = <T extends VaultLike>(
  vaults: T[],
  isPro: boolean,
): Set<string> => {
  const list = vaults || [];
  if (isPro || list.length <= FREE_VAULT_CAP) return new Set();
  return new Set(sortVaultsByAge(list).slice(FREE_VAULT_CAP).map(v => v.id));
};

export const isVaultDepositLocked = <T extends VaultLike>(
  vaultId: string,
  vaults: T[],
  isPro: boolean,
): boolean => lockedVaultIds(vaults, isPro).has(vaultId);

// A vault's spending class. Rows created before the asset_class column carry
// null, and Vaults.tsx has always rendered those under Sinking Funds, so null
// means SINKING_FUND everywhere rather than only on that one screen. Strict
// `=== 'SINKING_FUND'` comparisons hid legacy vaults from the Velocity sweep
// picker and the dashboard split while still listing them on the Vaults page.
export const isSinkingFund = (v: { asset_class?: string | null }): boolean =>
  (v.asset_class ?? 'SINKING_FUND') === 'SINKING_FUND';
