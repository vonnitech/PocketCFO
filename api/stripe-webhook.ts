import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Receives Stripe events and updates profiles.pro_* via the service role
// (bypasses RLS). Env (set in Vercel): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
);

// Stripe signature verification needs the raw, unparsed body.
export const config = { api: { bodyParser: false } };

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

async function setEntitlement(userId: string, fields: Record<string, unknown>) {
  if (!userId) return;
  const { error } = await supabase.from('profiles').update({ pro_source: 'stripe', ...fields }).eq('id', userId);
  if (error) console.error('[webhook] supabase update failed', error);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  let event: Stripe.Event;
  try {
    const raw = await readRawBody(req);
    const sig = req.headers['stripe-signature'] as string;
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET ?? '');
  } catch (e) {
    console.error('[webhook] signature verification failed', e);
    return res.status(400).send('bad signature');
  }

  try {
    switch (event.type) {
      // One-time (lifetime) purchase, or the initial subscription checkout.
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = s.metadata?.userId || (s.client_reference_id ?? '');
        const plan = s.metadata?.plan;
        if (plan === 'lifetime') {
          await setEntitlement(userId, {
            pro_plan: 'lifetime',
            pro_expires_at: null,
            stripe_customer_id: typeof s.customer === 'string' ? s.customer : null,
          });
        } else if (typeof s.customer === 'string') {
          // Subscriptions: stamp the customer id; the subscription event sets plan/expiry.
          await setEntitlement(userId, { stripe_customer_id: s.customer });
        }
        break;
      }
      // Subscription created / renewed / cancelled.
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId ?? '';
        const active = sub.status === 'active' || sub.status === 'trialing';
        const item = sub.items.data[0];
        const interval = item?.price.recurring?.interval;
        // In current Stripe API versions current_period_end lives on the item.
        const periodEnd = item?.current_period_end;
        await setEntitlement(userId, {
          pro_plan: active ? (interval === 'year' ? 'annual' : 'monthly') : null,
          pro_expires_at: active && periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        });
        break;
      }
      default:
        break;
    }
    return res.status(200).json({ received: true });
  } catch (e) {
    console.error('[webhook] handler error', e);
    return res.status(500).send('handler error');
  }
}
