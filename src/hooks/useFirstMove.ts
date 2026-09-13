import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';

const STORAGE_BASE = 'pocket-cfo-first-move-v1';

function wasDismissed(key: string): boolean {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

export function useFirstMove() {
  const userId = useStore(s => s.userId);
  const hasCompletedAction = useStore(s =>
    s.transactions.length > 0 ||
    s.reconHistory.length > 0 ||
    s.vaults.length > 0 ||
    s.deletedVaults.length > 0 ||
    s.stats.subscriptionsCancelled > 0,
  );
  const storageKey = userId ? `${STORAGE_BASE}-${userId}` : STORAGE_BASE;
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  // Remember completion even if the user later removes the activity or it
  // falls outside the history loaded by the dashboard.
  useEffect(() => {
    if (!hasCompletedAction) return;
    try { localStorage.setItem(storageKey, '1'); } catch {}
    setDismissedKey(storageKey);
  }, [hasCompletedAction, storageKey]);

  const dismiss = () => {
    try { localStorage.setItem(storageKey, '1'); } catch {}
    setDismissedKey(storageKey);
  };

  return {
    visible: !hasCompletedAction && dismissedKey !== storageKey && !wasDismissed(storageKey),
    dismiss,
  };
}
