import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { planForPrice, verifyPaddleSignature } from './_paddle.js';

// Receives Paddle webhooks and updates profiles.pro_* via the service role.
// Register this URL as a notification destination in Paddle (Developer tools ->
// Notifications) subscribed to the subscription.* events. Env: see
// api/_paddle.ts, plus SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Migration 027 must be applied before deployment.
//
// Delivery contract: only a 2xx within 5 seconds counts as delivered, anything
// else is retried with the same event, and events can arrive out of order. So
// every write here is idempotent and ordered by the subscription's updated_at,
// and anything that should be retried (bad signature, unknown price, database
// error) returns non-2xx.
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

type Subscription = {
  id?: string;
  status?: string;
  customer_id?: string;
  updated_at?: string;
  items?: { price?: { id?: string } }[];
  current_billing_period?: { ends_at?: string } | null;
  scheduled_change?: { action?: string; effective_at?: string } | null;
};

// Statuses that still grant access. A cancellation made mid-period keeps the
// status 'active' with a scheduled change until the period ends, and
// 'past_due' is Paddle's payment-retry window.
const GRANTING = new Set(['active', 'trialing', 'past_due']);
const REVOKING = new Set(['canceled', 'paused']);

// The renewal webhook lands shortly after the period ends. Without a buffer, a
// paying customer would lose Pro in that gap on every renewal.
const RENEWAL_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

function accessUntil(sub: Subscription): string | null {
  const change = sub.scheduled_change;
  if (change?.effective_at && (change.action === 'cancel' || change.action === 'pause')) {
    return new Date(change.effective_at).toISOString();
  }
  const ends = sub.current_billing_period?.ends_at;
  return ends ? new Date(Date.parse(ends) + RENEWAL_GRACE_MS).toISOString() : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Fail closed: without a secret every signature check would be meaningless.
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[paddle-webhook] PADDLE_WEBHOOK_SECRET is not set; refusing to verify');
    return res.status(500).send('webhook not configured');
  }

  let raw: Buffer;
  try {
    raw = await readRawBody(req);
    if (!verifyPaddleSignature(raw, String(req.headers['paddle-signature'] ?? ''), secret)) {
      return res.status(401).send('bad signature');
    }
  } catch {
    return res.status(401).send('bad signature');
  }

  try {
    const event = JSON.parse(raw.toString('utf8')) as { event_type?: string; data?: Subscription };
    const type = event.event_type ?? '';
    // Only subscription events change entitlement; acknowledge everything else.
    if (!type.startsWith('subscription.')) return res.status(200).json({ received: true });

    const sub = event.data ?? {};
    const status = sub.status ?? '';
    if (!/^sub_[a-z\d]+$/.test(sub.id ?? '') || !/^ctm_[a-z\d]+$/.test(sub.customer_id ?? '')) {
      return res.status(400).send('malformed subscription');
    }
    const updatedAt = new Date(sub.updated_at ?? '').toISOString();

    // The account is found by the customer the server linked before checkout,
    // never by data the browser could have supplied.
    const { data: profile, error: lookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('paddle_customer_id', sub.customer_id!)
      .maybeSingle() as { data: { id: string } | null; error: { code?: string } | null };
    if (lookupError) throw new Error(`profile lookup failed: ${lookupError.code ?? 'unknown'}`);
    if (!profile) {
      // A customer this app never created (for example one made in the Paddle
      // dashboard). Nothing to entitle, and retrying will not change that.
      console.info('[paddle-webhook] no account for customer; ignored');
      return res.status(200).json({ received: true });
    }

    let fields: Record<string, unknown>;
    let ownSubscriptionOnly = false;
    if (GRANTING.has(status)) {
      const plan = sub.items?.map(i => planForPrice(i.price?.id)).find(Boolean);
      // A price this deployment does not know means its env is out of step with
      // the Paddle catalog. Non-2xx keeps the event retrying until that is fixed.
      if (!plan) return res.status(400).send('unknown price');
      fields = {
        pro_plan: plan,
        pro_expires_at: accessUntil(sub),
        paddle_subscription_id: sub.id,
      };
    } else if (REVOKING.has(status)) {
      fields = { pro_plan: null, pro_expires_at: null, paddle_subscription_id: null };
      ownSubscriptionOnly = true;
    } else {
      return res.status(200).json({ received: true });
    }

    let query = supabase.from('profiles')
      .update({ pro_source: 'paddle', paddle_event_updated_at: updatedAt, ...fields })
      .eq('id', profile.id)
      // Retries are harmless and a delayed older event cannot roll state back.
      .or(`paddle_event_updated_at.is.null,paddle_event_updated_at.lte.${updatedAt}`);
    // Ending one subscription must never revoke Pro that a different
    // subscription, or the other billing provider, is providing.
    if (ownSubscriptionOnly) {
      query = query.eq('paddle_subscription_id', sub.id!).eq('pro_source', 'paddle');
    }
    const { data: updated, error } = await query.select('id');
    if (error) throw new Error(`entitlement update failed: ${error.code ?? 'unknown'}`);
    if (!updated?.length) console.info('[paddle-webhook] stale or unrelated event; ignored');

    return res.status(200).json({ received: true });
  } catch (e) {
    console.error('[paddle-webhook] handler error', e instanceof Error ? e.message : 'unknown');
    return res.status(500).send('handler error');
  }
}
