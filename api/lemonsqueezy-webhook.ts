import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Receives LemonSqueezy webhooks and updates profiles.pro_* via the service
// role (bypasses RLS). Register this URL in LemonSqueezy → Settings → Webhooks.
// Env (set in Vercel): LEMONSQUEEZY_WEBHOOK_SECRET, LEMONSQUEEZY_VARIANT_MONTHLY/
// ANNUAL/LIFETIME, LEMONSQUEEZY_STORE_ID, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Migration 022 must be applied before deployment.
const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
);

// Signature verification needs the raw, unparsed body.
export const config = { api: { bodyParser: false } };

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    bytes += buffer.length;
    if (bytes > 1024 * 1024) throw new Error('payload too large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

// variant_id -> plan, so subscription events know monthly vs annual. Falls back
// to the plan stamped on the checkout's custom data.
function planFromVariant(variantId: unknown): string | undefined {
  const id = variantId != null ? String(variantId) : '';
  if (id && id === process.env.LEMONSQUEEZY_VARIANT_ANNUAL)  return 'annual';
  if (id && id === process.env.LEMONSQUEEZY_VARIANT_MONTHLY) return 'monthly';
  return undefined;
}

async function setEntitlement(
  userId: string,
  eventUpdatedAt: string,
  fields: Record<string, unknown>,
  expectedSubscriptionId?: string,
) {
  let query = supabase.from('profiles')
    .update({ pro_source: 'lemonsqueezy', ls_event_updated_at: eventUpdatedAt, ...fields })
    .eq('id', userId)
    // Retries are harmless and delayed older events cannot roll state backwards.
    .or(`ls_event_updated_at.is.null,ls_event_updated_at.lte.${eventUpdatedAt}`);
  // A late expiry from an old subscription must not revoke a replacement plan.
  if (expectedSubscriptionId) query = query.eq('ls_subscription_id', expectedSubscriptionId);
  const { data, error } = await query.select('id');
  if (error) throw new Error(`Supabase entitlement update failed: ${error.message}`);
  if (!data?.length) console.info('[webhook] ignored stale or unknown entitlement event');
}

// Subscription statuses that still grant access. 'cancelled' keeps access until
// ends_at; 'past_due' is a payment-retry grace window.
const ACTIVE_STATUSES = new Set(['active', 'on_trial', 'cancelled', 'past_due']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
    return res.status(415).send('expected application/json');
  }

  // Fail closed. With no secret the HMAC below would still be computed, against
  // an empty key, and anyone able to derive that could forge entitlements.
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook] LEMONSQUEEZY_WEBHOOK_SECRET is not set; refusing to verify');
    return res.status(500).send('webhook not configured');
  }

  let raw: Buffer;
  try {
    raw = await readRawBody(req);
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
    if (!name || req.headers['x-event-name'] !== name) return res.status(400).send('event name mismatch');
    const custom = event?.meta?.custom_data ?? {};
    const userId: string = custom.user_id ?? '';
    const attr = event?.data?.attributes ?? {};
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return res.status(400).send('invalid user');
    }
    if (!process.env.LEMONSQUEEZY_STORE_ID || String(attr.store_id) !== process.env.LEMONSQUEEZY_STORE_ID) {
      return res.status(400).send('wrong store');
    }
    const eventUpdatedAt = new Date(attr.updated_at ?? attr.created_at ?? '').toISOString();
    const customerId = attr.customer_id != null ? String(attr.customer_id) : null;

    switch (name) {
      // One-time (lifetime) purchase. order_created also fires for a subscription's
      // first payment, so only treat it as lifetime when the checkout tagged it as
      // such; the subscription events below handle recurring plans.
      case 'order_created': {
        if (custom.plan === 'lifetime' && String(attr.first_order_item?.variant_id ?? attr.variant_id) === process.env.LEMONSQUEEZY_VARIANT_LIFETIME) {
          await setEntitlement(userId, eventUpdatedAt, {
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
        const plan = planFromVariant(attr.variant_id);
        if (!plan) return res.status(400).send('unknown subscription variant');
        // Cancelled subs run until ends_at; active subs run until renews_at.
        const until = status === 'cancelled' ? attr.ends_at : attr.renews_at;
        await setEntitlement(userId, eventUpdatedAt, {
          pro_plan: active ? plan : null,
          pro_expires_at: active && until ? new Date(until).toISOString() : null,
          ls_customer_id: customerId,
          ls_subscription_id: event?.data?.id != null ? String(event.data.id) : null,
        });
        break;
      }
      // Subscription fully ended (period elapsed, or unpaid after retries): revoke.
      case 'subscription_expired': {
        const subscriptionId = event?.data?.id != null ? String(event.data.id) : '';
        if (!subscriptionId) return res.status(400).send('missing subscription');
        await setEntitlement(userId, eventUpdatedAt, {
          pro_plan: null, pro_expires_at: null,
          ls_subscription_id: null,
        }, subscriptionId);
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
