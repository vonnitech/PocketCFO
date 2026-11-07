import crypto from 'node:crypto';

// Shared Paddle plumbing for the billing endpoints. The underscore prefix keeps
// this file out of Vercel's route table.
//
// Env (set in Vercel, and in .env.local for `vercel dev`):
//   PADDLE_ENV             'sandbox' or 'production'. Anything else is sandbox,
//                          so a missing value can never charge real cards.
//   PADDLE_API_KEY         server-side API key for that environment
//   PADDLE_WEBHOOK_SECRET  secret of the notification destination
//   PADDLE_PRICE_MONTHLY / PADDLE_PRICE_ANNUAL   pri_... ids for that environment

export const PADDLE_LIVE = process.env.PADDLE_ENV === 'production';
const API_BASE = PADDLE_LIVE ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';

export type Plan = 'monthly' | 'annual';

export function priceIdFor(plan: unknown): string | undefined {
  if (plan === 'monthly') return process.env.PADDLE_PRICE_MONTHLY || undefined;
  if (plan === 'annual') return process.env.PADDLE_PRICE_ANNUAL || undefined;
  return undefined;
}

export function planForPrice(priceId: unknown): Plan | undefined {
  const id = typeof priceId === 'string' ? priceId : '';
  if (id && id === process.env.PADDLE_PRICE_MONTHLY) return 'monthly';
  if (id && id === process.env.PADDLE_PRICE_ANNUAL) return 'annual';
  return undefined;
}

export class PaddleApiError extends Error {
  constructor(public status: number, public code: string) {
    super(`Paddle API ${status} ${code}`);
  }
}

// Thin JSON client. Errors carry Paddle's error code but never the response
// body, which can contain customer details, so logs stay clean.
export async function paddleApi<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new PaddleApiError(500, 'missing_api_key');
  const resp = await fetch(`${API_BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const json = await resp.json().catch(() => ({})) as { data?: T; error?: { code?: string } };
  if (!resp.ok) throw new PaddleApiError(resp.status, json.error?.code ?? 'unknown');
  return json.data as T;
}

// Paddle sends webhooks only from a published set of addresses. The list is
// fetched from Paddle (GET /ips, `ipv4_cidrs`) rather than hard-coded, because
// Paddle can change it, and cached per function instance for an hour. If the
// list cannot be fetched and nothing is cached, callers get null and should
// refuse the delivery; Paddle retries it later.
const IPS_TTL_MS = 60 * 60 * 1000;
let ipsCache: { cidrs: string[]; fetchedAt: number } | null = null;

export async function paddleWebhookCidrs(now = Date.now()): Promise<string[] | null> {
  if (ipsCache && now - ipsCache.fetchedAt < IPS_TTL_MS) return ipsCache.cidrs;
  try {
    const resp = await fetch(`${API_BASE}/ips`, { headers: { Accept: 'application/json' } });
    const json = await resp.json() as { data?: { ipv4_cidrs?: unknown } };
    const cidrs = Array.isArray(json.data?.ipv4_cidrs)
      ? json.data.ipv4_cidrs.filter((c): c is string => typeof c === 'string')
      : [];
    if (!resp.ok || cidrs.length === 0) throw new Error(`ips ${resp.status}`);
    ipsCache = { cidrs, fetchedAt: now };
  } catch {
    // A stale list beats none: Paddle rarely changes it.
    if (!ipsCache) return null;
  }
  return ipsCache.cidrs;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;
    n = n * 256 + Number(part);
  }
  return n;
}

export function ipInCidrs(ip: string, cidrs: string[]): boolean {
  const addr = ipv4ToInt(ip.replace(/^::ffff:/, ''));
  if (addr === null) return false;
  return cidrs.some(cidr => {
    const [base, bitsText = '32'] = cidr.split('/');
    const start = ipv4ToInt(base);
    const bits = Number(bitsText);
    if (start === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    const size = 2 ** (32 - bits);
    return Math.floor(addr / size) === Math.floor(start / size);
  });
}

// Signatures are `ts=<unix>;h1=<hex>[;h1=<hex>...]`, an HMAC-SHA256 of
// `${ts}:${rawBody}` keyed with the destination secret. More than one h1 can
// appear while Paddle rotates a secret, so any match is accepted.
//
// Paddle's SDKs reject timestamps more than 5 seconds off. That is tight for a
// cold-started function, so this allows a minute: a replayed event inside that
// window is harmless anyway, because every write it can cause is idempotent
// and ordered by updated_at.
const MAX_SIGNATURE_AGE_SECONDS = 60;

export function verifyPaddleSignature(
  rawBody: Buffer,
  header: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !header) return false;
  let ts = '';
  const signatures: string[] = [];
  for (const part of header.split(';')) {
    const [key, value] = part.split('=', 2).map(s => s?.trim() ?? '');
    if (key === 'ts') ts = value;
    else if (key === 'h1' && value) signatures.push(value);
  }
  if (!/^\d+$/.test(ts) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - Number(ts)) > MAX_SIGNATURE_AGE_SECONDS) return false;

  const expected = Buffer.from(
    crypto.createHmac('sha256', secret).update(`${ts}:`).update(rawBody).digest('hex'),
    'utf8',
  );
  return signatures.some(sig => {
    const given = Buffer.from(sig, 'utf8');
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}
