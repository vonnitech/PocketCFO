import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from './_auth.js';
import { PaddleApiError, paddleApi } from './_paddle.js';

// Returns a signed billing-portal URL so a customer can manage / cancel their
// subscription and view receipts. New subscribers are on Paddle; anyone whose
// Pro still comes from LemonSqueezy gets the LemonSqueezy portal instead.
// Env: PADDLE_* (api/_paddle.ts), LEMONSQUEEZY_API_KEY, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.
const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
);

const isHost = (url: URL, domain: string) =>
  url.hostname === domain || url.hostname.endsWith(`.${domain}`);

// Only ever hand the browser an https link on the provider's own domain.
function trusted(url: unknown, domain: string): string | null {
  try {
    const parsed = new URL(String(url ?? ''));
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !isHost(parsed, domain)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

async function paddlePortal(customerId: string, subscriptionId: string | null): Promise<string | null> {
  // Sessions are short-lived and must not be cached, so one is made per click.
  const session = await paddleApi<{ urls?: { general?: { overview?: string } } }>(
    `/customers/${encodeURIComponent(customerId)}/portal-sessions`,
    { method: 'POST', body: subscriptionId ? { subscription_ids: [subscriptionId] } : {} },
  );
  return trusted(session?.urls?.general?.overview, 'paddle.com');
}

async function lemonSqueezyPortal(customerId: string): Promise<string | null> {
  const resp = await fetch(`https://api.lemonsqueezy.com/v1/customers/${encodeURIComponent(customerId)}`, {
    headers: {
      Accept: 'application/vnd.api+json',
      Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY ?? ''}`,
    },
  });
  if (!resp.ok) return null;
  const json = await resp.json() as { data?: { attributes?: { urls?: { customer_portal?: string } } } };
  return trusted(json?.data?.attributes?.urls?.customer_portal, 'lemonsqueezy.com');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // The portal exposes receipts, billing address and cancellation, so the
    // account is taken from the caller's verified token, not the request body.
    const caller = await requireUser(req);
    if (!caller) return res.status(401).json({ error: 'Not signed in' });

    const { data, error } = await supabase
      .from('profiles')
      .select('pro_source, paddle_customer_id, paddle_subscription_id, ls_customer_id')
      .eq('id', caller.id)
      .maybeSingle() as {
        data: {
          pro_source?: string | null;
          paddle_customer_id?: string | null;
          paddle_subscription_id?: string | null;
          ls_customer_id?: string | null;
        } | null;
        error: { code?: string } | null;
      };

    if (error) {
      console.error('[portal] billing lookup failed', { code: error.code ?? 'unknown' });
      return res.status(502).json({ error: 'Could not open billing portal' });
    }

    let url: string | null;
    if (data?.pro_source === 'lemonsqueezy' && data.ls_customer_id) {
      url = await lemonSqueezyPortal(data.ls_customer_id);
    } else if (data?.paddle_customer_id) {
      url = await paddlePortal(data.paddle_customer_id, data.paddle_subscription_id ?? null);
    } else if (data?.ls_customer_id) {
      url = await lemonSqueezyPortal(data.ls_customer_id);
    } else {
      return res.status(400).json({ error: 'No billing account found' });
    }

    if (!url) {
      console.error('[portal] provider returned no usable link');
      return res.status(502).json({ error: 'Could not open billing portal' });
    }
    return res.status(200).json({ url });
  } catch (e) {
    const code = e instanceof PaddleApiError ? `${e.status} ${e.code}` : 'internal';
    console.error('[portal] request failed', { code });
    return res.status(500).json({ error: 'Could not open billing portal' });
  }
}
