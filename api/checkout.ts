import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './_auth';

// Creates a LemonSqueezy Checkout for a Pro plan and returns its hosted URL.
// Env (set in Vercel): LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID,
// LEMONSQUEEZY_VARIANT_MONTHLY/ANNUAL/LIFETIME.
const VARIANT_IDS: Record<string, string | undefined> = {
  monthly:  process.env.LEMONSQUEEZY_VARIANT_MONTHLY,
  annual:   process.env.LEMONSQUEEZY_VARIANT_ANNUAL,
  lifetime: process.env.LEMONSQUEEZY_VARIANT_LIFETIME,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // user_id is echoed back by every webhook and decides which profile gets
    // entitled, so it comes from the verified token. Left body-supplied, anyone
    // could tag a checkout with someone else's id and overwrite their billing
    // link. Only the plan is caller's choice.
    const caller = await requireUser(req);
    if (!caller) return res.status(401).json({ error: 'Not signed in' });

    const { plan } = (req.body ?? {}) as { plan?: string };
    const variantId = plan ? VARIANT_IDS[plan] : undefined;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    if (!variantId || !storeId || !apiKey) {
      return res.status(400).json({ error: 'Unknown or unconfigured plan' });
    }

    const origin = (req.headers.origin as string) ?? `https://${req.headers.host}`;

    const resp = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              // email pre-fills the form; custom is echoed back in every webhook's
              // meta.custom_data so we know which profile to entitle. plan also
              // disambiguates a lifetime order from a subscription's first order.
              ...(caller.email ? { email: caller.email } : {}),
              custom: { user_id: caller.id, plan: plan ?? '' },
            },
            product_options: {
              redirect_url: `${origin}/settings?pro=success`,
            },
          },
          relationships: {
            store:   { data: { type: 'stores',   id: String(storeId) } },
            variant: { data: { type: 'variants', id: String(variantId) } },
          },
        },
      }),
    });

    const json = await resp.json() as { data?: { attributes?: { url?: string } } };
    const url = json?.data?.attributes?.url;
    if (!resp.ok || !url) {
      console.error('[checkout] lemonsqueezy error', resp.status, json);
      return res.status(502).json({ error: 'Checkout failed' });
    }

    return res.status(200).json({ url });
  } catch (e) {
    console.error('[checkout]', e);
    return res.status(500).json({ error: 'Checkout failed' });
  }
}
