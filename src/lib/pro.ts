import { useEffect, useReducer } from 'react';
import { supabase } from '../core/supabase';

// Pro tier gate.
//
// One source of truth: profiles.pro_plan / pro_expires_at, written by the
// LemonSqueezy webhook (api/lemonsqueezy-webhook.ts) through the service role.
// Those columns are not user-writable; migration 011_billing_column_guard
// rejects any client that tries. Fetched once and shared by every consumer.

// ── Entitlement (module-cached: one query, shared across all consumers) ───────
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

// Non-hook read of the cached entitlement, for guards that run outside React
// (store actions). `loaded` is exposed so callers can tell "definitely free"
// from "not fetched yet" and avoid locking a paying user out during the first
// fetch. UI gates should keep using the hooks; this is the belt to their braces.
export function proSnapshot(): { isPro: boolean; loaded: boolean } {
  return { isPro: entitlement.isPro, loaded: entitlement.loaded };
}

// Force a re-fetch (e.g. after returning from LemonSqueezy Checkout).
export function refreshProStatus(): void {
  entitlement = { isPro: false, loaded: false };
  inFlight = loadEntitlement();
}

// isLoading stays exposed so surfaces that would flash a paywall can wait for
// the first fetch instead of rendering a locked state they will immediately
// take back.
export function useProStatus(): { isPro: boolean; isLoading: boolean } {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    entListeners.add(force);
    if (!entitlement.loaded && !inFlight) inFlight = loadEntitlement();
    return () => { entListeners.delete(force); };
  }, []);
  return { isPro: entitlement.isPro, isLoading: !entitlement.loaded };
}

// Boolean-only view for the gates that just need locked/unlocked.
export function useIsPro(): boolean {
  return useProStatus().isPro;
}
