import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Returns a signed LemonSqueezy Customer Portal URL so a customer can manage /
// cancel / update their subscription and view receipts.
// Env: LEMONSQUEEZY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId } = (req.body ?? {}) as { userId?: string };
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const { data } = await supabase
      .from('profiles')
      .select('ls_customer_id')
      .eq('id', userId)
      .maybeSingle() as { data: { ls_customer_id?: string | null } | null };

    const customerId = data?.ls_customer_id;
    if (!customerId) return res.status(400).json({ error: 'No billing account found' });

    // The portal link lives on the customer resource as a short-lived signed URL,
    // so we fetch it fresh on each request.
    const resp = await fetch(`https://api.lemonsqueezy.com/v1/customers/${customerId}`, {
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY ?? ''}`,
      },
    });
    const json = await resp.json() as { data?: { attributes?: { urls?: { customer_portal?: string } } } };
    const url = json?.data?.attributes?.urls?.customer_portal;
    if (!resp.ok || !url) {
      console.error('[portal] lemonsqueezy error', resp.status, json);
      return res.status(502).json({ error: 'Could not open billing portal' });
    }

    return res.status(200).json({ url });
  } catch (e) {
    console.error('[portal]', e);
    return res.status(500).json({ error: 'Could not open billing portal' });
  }
}
