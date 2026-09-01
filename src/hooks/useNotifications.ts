// React bindings for the notification engine.
//
// `useNotificationEngine` is mounted exactly once (in App) and is what actually
// drives ticks. `useNotifications` is the read/write view any component can use.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import {
  clearInbox,
  getPrefs,
  getRecords,
  getUnreadCount,
  initForUser,
  markAllRead,
  markPrimerAnswered,
  markRead,
  permissionState,
  requestPermission,
  setCategoryEnabled,
  setMode,
  subscribe,
  subscribeToEmissions,
  tick,
  type NotificationCategory,
  type NotificationPrefs,
  type NotificationRecord,
  type PermissionState,
} from '../core/notifications';

// ── Engine driver ────────────────────────────────────────────────────────────

// How often to re-evaluate while the app sits open. Rules are pure and cheap, so
// this is only about catching time-based conditions (the evening Daily Review
// window, a bill crossing into range) without waiting for a tab switch.
const TICK_INTERVAL_MS = 15 * 60 * 1000;

// Money state changes in bursts (a CSV import, a payday catch-up). Debouncing
// means one evaluation after the dust settles rather than one per write.
const STATE_DEBOUNCE_MS = 3000;

// The fields that can change what a rule decides. Anything not in here cannot
// affect an evaluation, so it should not trigger one.
function ruleSignature(): string {
  const s = useStore.getState();
  return [
    s.userId ?? '',
    s.dataFresh ? '1' : '0',
    s.isConfigured ? '1' : '0',
    s.hasCompletedOnboarding ? '1' : '0',
    Math.round(s.safeSpendLimit),
    s.nextPayday,
    s.transactions.length,
    s.reconHistory.length,
    s.billQueue.length,
    s.subscriptions.length,
  ].join('|');
}

export function useNotificationEngine(): void {
  const userId    = useStore(s => s.userId);
  const dataFresh = useStore(s => s.dataFresh);

  useEffect(() => { initForUser(userId); }, [userId]);

  useEffect(() => {
    if (!dataFresh) return;

    const run = () => { tick(useStore.getState()); };

    // Fire once as soon as Supabase has confirmed the data.
    run();

    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVisible);

    const interval = setInterval(run, TICK_INTERVAL_MS);

    let debounce: ReturnType<typeof setTimeout> | undefined;
    let lastSignature = ruleSignature();
    const unsubscribeStore = useStore.subscribe(() => {
      const next = ruleSignature();
      if (next === lastSignature) return;
      lastSignature = next;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(run, STATE_DEBOUNCE_MS);
    });

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
      if (debounce) clearTimeout(debounce);
      unsubscribeStore();
    };
  }, [dataFresh]);
}

// ── Consumer view ────────────────────────────────────────────────────────────

export interface UseNotifications {
  records: NotificationRecord[];
  unreadCount: number;
  prefs: NotificationPrefs;
  permission: PermissionState;
  supported: boolean;
  setMode: (mode: NotificationPrefs['mode']) => void;
  toggleCategory: (category: NotificationCategory) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearInbox: () => void;
  // Resolves to the permission that resulted. Must be called from a click.
  askPermission: () => Promise<PermissionState>;
  answerPrimer: (answer: 'accepted' | 'dismissed') => void;
}

export function useNotifications(): UseNotifications {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [permission, setPermission] = useState<PermissionState>(() => permissionState());

  useEffect(() => subscribe(force), []);

  // The user can flip permission in browser settings while the tab is open, and
  // there is no event for it. Re-reading on focus is the cheap approximation.
  useEffect(() => {
    const sync = () => setPermission(permissionState());
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const askPermission = useCallback(async () => {
    const result = await requestPermission();
    setPermission(result);
    // A granted prompt is only useful if something can actually be sent, so an
    // accepted ask upgrades a muted account to the important-only default.
    if (result === 'granted' && getPrefs().mode === 'off') setMode('important');
    return result;
  }, []);

  const prefs = getPrefs();

  return {
    records: getRecords(),
    unreadCount: getUnreadCount(),
    prefs,
    permission,
    supported: permission !== 'unsupported',
    setMode,
    toggleCategory: (category) => setCategoryEnabled(category, prefs.categories[category] === false),
    markRead,
    markAllRead,
    clearInbox,
    askPermission,
    answerPrimer: markPrimerAnswered,
  };
}

// ── In-app banner queue ──────────────────────────────────────────────────────

// Records emitted while the app is in the foreground never buzz the device, so
// this is how the user actually sees them in the moment.
export function useNotificationToasts(): {
  toast: NotificationRecord | null;
  dismiss: () => void;
} {
  const [queue, setQueue] = useState<NotificationRecord[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => subscribeToEmissions(records => {
    setQueue(prev => [...prev, ...records]);
  }), []);

  const dismiss = useCallback(() => {
    setQueue(prev => prev.slice(1));
  }, []);

  // Auto-dismiss so a banner never blocks the dashboard. The record stays in the
  // inbox either way, so nothing is lost by letting it go.
  useEffect(() => {
    if (queue.length === 0) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(dismiss, 9000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [queue, dismiss]);

  return { toast: queue[0] ?? null, dismiss };
}
