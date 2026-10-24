import { initializePaddle, type Paddle } from '@paddle/paddle-js';

// Paddle.js, loaded on first use only. Every page that never opens checkout
// skips Paddle's script entirely, and initializePaddle refuses a second call,
// so the instance is shared.
//
// Env (Vite): VITE_PADDLE_CLIENT_TOKEN (client-side token, safe to expose) and
// VITE_PADDLE_ENV ('sandbox' or 'production'). The token is scoped to one
// environment, so these two must match the server's PADDLE_ENV.
const token = (import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined) ?? '';
const environment = import.meta.env.VITE_PADDLE_ENV === 'production' ? 'production' : 'sandbox';

let instance: Promise<Paddle | null> | null = null;

function loadPaddle(): Promise<Paddle | null> {
  if (!token) return Promise.resolve(null);
  instance ??= initializePaddle({ token, environment })
    .then(p => p ?? null)
    .catch(() => { instance = null; return null; });
  return instance;
}

/**
 * Opens Paddle's overlay checkout for a transaction prepared by /api/checkout.
 * Resolves false if Paddle.js could not load, so the caller can say so.
 */
export async function openPaddleCheckout(transactionId: string): Promise<boolean> {
  const paddle = await loadPaddle();
  if (!paddle) return false;
  paddle.Checkout.open({
    transactionId,
    settings: {
      variant: 'one-page',
      // Back to Settings, which waits for the webhook to switch Pro on. The
      // redirect itself never grants anything.
      successUrl: `${window.location.origin}/settings?pro=success`,
    },
  });
  return true;
}
