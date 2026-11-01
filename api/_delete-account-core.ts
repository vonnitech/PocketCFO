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

  const resp = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (resp.ok || resp.status === 404) return null;

  console.error('[delete-account] billing cancellation failed', { status: resp.status });
  return { ok: false, status: 502, error: 'Could not cancel active subscription' };
}

// Paddle replaced LemonSqueezy for new subscribers. Checked first, so a status
// read tells us whether there is anything left to cancel: cancelling an already
// cancelled subscription is an error at Paddle, not a no-op.
async function cancelPaddleSubscription(env: Env, subscriptionId: string): Promise<DeleteAccountResult | null> {
  const apiKey = env.PADDLE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      error: 'Account deletion is not configured to cancel active billing. Missing PADDLE_API_KEY.',
    };
  }
  const base = env.PADDLE_ENV === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
  const url = `${base}/subscriptions/${encodeURIComponent(subscriptionId)}`;
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' };

  const current = await fetch(url, { headers });
  if (current.status === 404) return null;
  if (current.ok) {
    const json = await current.json().catch(() => ({})) as { data?: { status?: string } };
    if (json.data?.status === 'canceled') return null;
    const resp = await fetch(`${url}/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ effective_from: 'immediately' }),
    });
    if (resp.ok) return null;
    console.error('[delete-account] paddle cancellation failed', { status: resp.status });
  } else {
    console.error('[delete-account] paddle lookup failed', { status: current.status });
  }
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
    .select('ls_subscription_id, paddle_subscription_id')
    .eq('id', userId)
    .maybeSingle() as {
      data: { ls_subscription_id?: string | null; paddle_subscription_id?: string | null } | null;
      error: { message?: string; code?: string } | null;
    };

  if (profileError) {
    console.error('[delete-account] billing lookup failed', { code: profileError.code ?? 'unknown' });
    return {
      ok: false,
      status: 502,
      error: 'Could not verify billing status. Please try again.',
    };
  }

  const paddleSubscriptionId = profile?.paddle_subscription_id;
  if (paddleSubscriptionId) {
    const cancelError = await cancelPaddleSubscription(env, paddleSubscriptionId);
    if (cancelError) return cancelError;
  }

  const subscriptionId = profile?.ls_subscription_id;
  if (subscriptionId) {
    const cancelError = await cancelLemonSqueezySubscription(env, subscriptionId);
    if (cancelError) return cancelError;
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    console.error('[delete-account] auth deletion failed', { code: error.code ?? 'unknown' });
    return { ok: false, status: 502, error: 'Could not delete account' };
  }

  return { ok: true, status: 200 };
}
