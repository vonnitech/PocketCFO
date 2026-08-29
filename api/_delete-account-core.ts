import { createClient } from '@supabase/supabase-js';

type Env = Record<string, string | undefined>;

export type DeleteAccountResult =
  | { ok: true; status: 200 }
  | { ok: false; status: number; error: string };

const supabaseUrl = (env: Env) => env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';

async function cancelLemonSqueezySubscription(env: Env, subscriptionId: string): Promise<DeleteAccountResult | null> {
  const apiKey = env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      error: 'Account deletion is not configured to cancel active billing. Missing LEMONSQUEEZY_API_KEY.',
    };
  }

  const resp = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (resp.ok || resp.status === 404) return null;

  const body = await resp.text().catch(() => '');
  console.error('[delete-account] lemonsqueezy cancel failed', resp.status, body);
  return { ok: false, status: 502, error: 'Could not cancel active subscription' };
}

export async function deleteAccountForToken(env: Env, accessToken: string): Promise<DeleteAccountResult> {
  const url = supabaseUrl(env);
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url) {
    return { ok: false, status: 500, error: 'Account deletion is not configured. Missing SUPABASE_URL.' };
  }
  if (!serviceRoleKey) {
    return { ok: false, status: 500, error: 'Account deletion is not configured. Missing SUPABASE_SERVICE_ROLE_KEY.' };
  }
  if (!accessToken) {
    return { ok: false, status: 401, error: 'Not signed in' };
  }

  const supabase = createClient(url, serviceRoleKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  const userId = userData.user?.id;
  if (userError || !userId) {
    return { ok: false, status: 401, error: 'Not signed in' };
  }

  // The error is checked, not discarded. If this lookup fails we cannot tell
  // whether the account has an active subscription, and proceeding would delete
  // the account while leaving LemonSqueezy billing it. The user would then have
  // no account left to cancel from. Failing here is recoverable (they retry);
  // deleting on a failed read is not.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('ls_subscription_id')
    .eq('id', userId)
    .maybeSingle() as {
      data: { ls_subscription_id?: string | null } | null;
      error: { message?: string } | null;
    };

  if (profileError) {
    console.error('[delete-account] billing lookup failed', profileError);
    return {
      ok: false,
      status: 502,
      error: 'Could not verify billing status. Please try again.',
    };
  }

  const subscriptionId = profile?.ls_subscription_id;
  if (subscriptionId) {
    const cancelError = await cancelLemonSqueezySubscription(env, subscriptionId);
    if (cancelError) return cancelError;
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    console.error('[delete-account] supabase admin error', error);
    return { ok: false, status: 502, error: 'Could not delete account' };
  }

  return { ok: true, status: 200 };
}
