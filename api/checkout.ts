import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

// Creates a Stripe Checkout Session for a Pro plan and returns its URL.
// Env (set in Vercel): STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY/ANNUAL/LIFETIME.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');

const PRICE_IDS: Record<string, string | undefined> = {
  monthly:  process.env.STRIPE_PRICE_MONTHLY,
  annual:   process.env.STRIPE_PRICE_ANNUAL,
  lifetime: process.env.STRIPE_PRICE_LIFETIME,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { plan, userId, email } = (req.body ?? {}) as { plan?: string; userId?: string; email?: string };
    const price = plan ? PRICE_IDS[plan] : undefined;
    if (!price) return res.status(400).json({ error: 'Unknown or unconfigured plan' });

    const origin = (req.headers.origin as string) ?? `https://${req.headers.host}`;
    // Lifetime is a one-time price (mode: payment); monthly/annual recur (mode: subscription).
    const mode: Stripe.Checkout.SessionCreateParams.Mode = plan === 'lifetime' ? 'payment' : 'subscription';

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/settings?pro=success`,
      cancel_url: `${origin}/settings#pro`,
      client_reference_id: userId,
      customer_email: email,
      metadata: { userId: userId ?? '', plan },
      // Stamp the same metadata on the subscription so renewal/cancel webhooks know the user.
      ...(mode === 'subscription' ? { subscription_data: { metadata: { userId: userId ?? '', plan } } } : {}),
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('[checkout]', e);
    return res.status(500).json({ error: 'Checkout failed' });
  }
}
