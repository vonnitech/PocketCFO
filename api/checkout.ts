import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from './_auth.js';
import { PaddleApiError, paddleApi, priceIdFor } from './_paddle.js';

// Prepares a Paddle checkout for a Pro plan and returns the transaction id.
// The browser opens it with Paddle.js (Paddle.Checkout.open({ transactionId })),
// so the price, customer and account are all fixed here on the server, never
// chosen by the browser.
//
// Entitlement is decided by /api/paddle-webhook, which finds the account by
// paddle_customer_id. That link is written below, before checkout opens, so a
// checkout someone opens from the browser in another person's name cannot
// reach that person's account. Env: see api/_paddle.ts.
const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
);

type Customer = { id: string };
type Transaction = { id: string };

// One Paddle customer per account. Paddle keeps customers unique by email, so an
// existing one (from an earlier, abandoned checkout) is reused, not duplicated.
async function customerFor(userId: string, email: string): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('paddle_customer_id')
    .eq('id', userId)
    .maybeSingle() as { data: { paddle_customer_id?: string | null } | null; error: { code?: string } | null };
  if (error) throw new Error(`profile lookup failed: ${error.code ?? 'unknown'}`);
  if (data?.paddle_customer_id) return data.paddle_customer_id;

  const existing = await paddleApi<Customer[]>(`/customers?email=${encodeURIComponent(email)}`);
  const customerId = existing[0]?.id ?? (await paddleApi<Customer>('/customers', {
    method: 'POST',
    body: { email },
  })).id;

  // Only fills an empty link, so a race between two checkouts cannot swap an
  // account onto a different customer.
  const { error: linkError } = await supabase
    .from('profiles')
    .update({ paddle_customer_id: customerId })
    .eq('id', userId)
    .is('paddle_customer_id', null);
  if (linkError) throw new Error(`customer link failed: ${linkError.code ?? 'unknown'}`);

  // Whichever link won is the one the webhook will use, so check out with it.
  const { data: linked } = await supabase
    .from('profiles')
    .select('paddle_customer_id')
    .eq('id', userId)
    .maybeSingle() as { data: { paddle_customer_id?: string | null } | null };
  if (!linked?.paddle_customer_id) throw new Error('customer link missing after write');
  return linked.paddle_customer_id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
    return res.status(415).json({ error: 'Expected application/json' });
  }

  try {
    const caller = await requireUser(req);
    if (!caller) return res.status(401).json({ error: 'Not signed in' });
    if (!caller.email) return res.status(400).json({ error: 'Your account needs an email address to subscribe' });

    const { plan } = (req.body ?? {}) as { plan?: string };
    const priceId = priceIdFor(plan);
    if (!priceId || !process.env.PADDLE_API_KEY) {
      return res.status(400).json({ error: 'Unknown or unconfigured plan' });
    }

    const customerId = await customerFor(caller.id, caller.email);
    const transaction = await paddleApi<Transaction>('/transactions', {
      method: 'POST',
      body: {
        items: [{ price_id: priceId, quantity: 1 }],
        customer_id: customerId,
        // For support and reporting only; the webhook does not trust it.
        custom_data: { user_id: caller.id, plan },
      },
    });

    if (!/^txn_[a-z\d]+$/.test(transaction?.id ?? '')) {
      console.error('[checkout] unexpected transaction id');
      return res.status(502).json({ error: 'Checkout failed' });
    }
    return res.status(200).json({ transactionId: transaction.id });
  } catch (e) {
    const code = e instanceof PaddleApiError ? `${e.status} ${e.code}` : 'internal';
    console.error('[checkout] request failed', { code });
    return res.status(502).json({ error: 'Checkout failed' });
  }
}
