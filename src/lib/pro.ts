import { useSyncExternalStore, useEffect, useReducer } from 'react';
import { supabase } from '../core/supabase';

// Pro tier gate.
//
// Two sources, OR'd together:
//   1. Real entitlement — profiles.pro_plan / pro_expires_at, written by the
//      LemonSqueezy webhook (see api/lemonsqueezy-webhook.ts). Fetched once and cached.
//   2. Local dev toggle — the Settings "Pro Access" switch, for testing both
//      states before billing is live. Remove the toggle once billing ships.
const KEY = 'pocket-cfo-pro';
const EVENT = 'pocket-cfo-pro-change';

export function isProUnlocked(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setProUnlocked(value: boolean): void {
  try {
    if (value) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable - ignore */
  }
  // Notify same-tab subscribers (the `storage` event only fires cross-tab).
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

// Reactive hook: re-renders consumers when the dev toggle flips.
export function useIsPro(): boolean {
  return useSyncExternalStore(subscribe, isProUnlocked, () => false);
}

// ── Real entitlement (module-cached: one query, shared across all consumers) ──
let entitlement = { isPro: false, loaded: false };
let inFlight: Promise<void> | null = null;
const entListeners = new Set<() => void>();

async function loadEntitlement(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { entitlement = { isPro: false, loaded: true }; }
    else {
      // pro_* columns may not exist until migration 008 runs — tolerate failure.
      const { data } = await supabase
        .from('profiles')
        .select('pro_plan, pro_expires_at')
        .eq('id', user.id)
        .maybeSingle() as { data: { pro_plan?: string | null; pro_expires_at?: string | null } | null };
      const plan = data?.pro_plan;
      const notExpired = !data?.pro_expires_at || new Date(data.pro_expires_at).getTime() > Date.now();
      entitlement = { isPro: !!plan && notExpired, loaded: true };
    }
  } catch {
    entitlement = { isPro: false, loaded: true };
  }
  entListeners.forEach(l => l());
}

// Force a re-fetch (e.g. after returning from LemonSqueezy Checkout).
export function refreshProStatus(): void {
  entitlement = { isPro: false, loaded: false };
  inFlight = loadEntitlement();
}

// Richer status hook: real entitlement OR the dev toggle. isLoading is true until
// the first entitlement fetch resolves, so paying users never get a paywall flash.
export function useProStatus(): { isPro: boolean; isLoading: boolean } {
  const devPro = useSyncExternalStore(subscribe, isProUnlocked, () => false);
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    entListeners.add(force);
    if (!entitlement.loaded && !inFlight) inFlight = loadEntitlement();
    return () => { entListeners.delete(force); };
  }, []);
  return { isPro: devPro || entitlement.isPro, isLoading: !entitlement.loaded };
}
