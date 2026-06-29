import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Opens the Stripe Billing Portal so a customer can manage / cancel / update
// their subscription (or view invoices for a lifetime purchase).
// Env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
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
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle() as { data: { stripe_customer_id?: string | null } | null };

    const customer = data?.stripe_customer_id;
    if (!customer) return res.status(400).json({ error: 'No billing account found' });

    const origin = (req.headers.origin as string) ?? `https://${req.headers.host}`;
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/settings#pro`,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('[portal]', e);
    return res.status(500).json({ error: 'Could not open billing portal' });
  }
}
