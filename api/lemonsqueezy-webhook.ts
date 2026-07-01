import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Receives LemonSqueezy webhooks and updates profiles.pro_* via the service
// role (bypasses RLS). Register this URL in LemonSqueezy → Settings → Webhooks.
// Env (set in Vercel): LEMONSQUEEZY_WEBHOOK_SECRET, LEMONSQUEEZY_VARIANT_MONTHLY/
// ANNUAL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
);

// Signature verification needs the raw, unparsed body.
export const config = { api: { bodyParser: false } };

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

// variant_id -> plan, so subscription events know monthly vs annual. Falls back
// to the plan stamped on the checkout's custom data.
function planFromVariant(variantId: unknown, fallback?: string): string | undefined {
  const id = variantId != null ? String(variantId) : '';
  if (id && id === process.env.LEMONSQUEEZY_VARIANT_ANNUAL)  return 'annual';
  if (id && id === process.env.LEMONSQUEEZY_VARIANT_MONTHLY) return 'monthly';
  return fallback || undefined;
}

async function setEntitlement(userId: string, fields: Record<string, unknown>) {
  if (!userId) return;
  const { error } = await supabase.from('profiles').update({ pro_source: 'lemonsqueezy', ...fields }).eq('id', userId);
  if (error) console.error('[webhook] supabase update failed', error);
}

// Subscription statuses that still grant access. 'cancelled' keeps access until
// ends_at; 'past_due' is a payment-retry grace window.
const ACTIVE_STATUSES = new Set(['active', 'on_trial', 'cancelled', 'past_due']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  let raw: Buffer;
  try {
    raw = await readRawBody(req);
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? '';
    const digest = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(digest, 'utf8');
    const b = Buffer.from((req.headers['x-signature'] as string) ?? '', 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).send('bad signature');
    }
  } catch (e) {
    console.error('[webhook] signature verification failed', e);
    return res.status(400).send('bad signature');
  }

  try {
    const event = JSON.parse(raw.toString('utf8'));
    const name: string = event?.meta?.event_name ?? '';
    const custom = event?.meta?.custom_data ?? {};
    const userId: string = custom.user_id ?? '';
    const attr = event?.data?.attributes ?? {};
    const customerId = attr.customer_id != null ? String(attr.customer_id) : null;

    switch (name) {
      // One-time (lifetime) purchase. order_created also fires for a subscription's
      // first payment, so only treat it as lifetime when the checkout tagged it as
      // such; the subscription events below handle recurring plans.
      case 'order_created': {
        if (custom.plan === 'lifetime') {
          await setEntitlement(userId, {
            pro_plan: 'lifetime',
            pro_expires_at: null,
            ls_customer_id: customerId,
          });
        }
        break;
      }
      // Subscription created / renewed / cancelled / resumed.
      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_resumed':
      case 'subscription_cancelled': {
        const status: string = attr.status ?? '';
        const active = ACTIVE_STATUSES.has(status);
        const plan = planFromVariant(attr.variant_id, custom.plan);
        // Cancelled subs run until ends_at; active subs run until renews_at.
        const until = status === 'cancelled' ? attr.ends_at : attr.renews_at;
        await setEntitlement(userId, {
          pro_plan: active ? (plan ?? 'monthly') : null,
          pro_expires_at: active && until ? new Date(until).toISOString() : null,
          ls_customer_id: customerId,
          ls_subscription_id: event?.data?.id != null ? String(event.data.id) : null,
        });
        break;
      }
      // Subscription fully ended (period elapsed, or unpaid after retries): revoke.
      case 'subscription_expired': {
        await setEntitlement(userId, { pro_plan: null, pro_expires_at: null });
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
