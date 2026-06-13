// ── Volatile key store — RAM only, wiped on page refresh or explicit lock ──
let _activeKey: CryptoKey | null = null;
export const setActiveKey = (key: CryptoKey | null): void => { _activeKey = key; };
export const getActiveKey = (): CryptoKey | null => _activeKey;

// ── Storage key constants ──────────────────────────────────────────────────
export const SALT_KEY  = 'pocket-cfo-salt';
export const STORE_KEY = 'pocket-cfo-store';

// ── Helpers ────────────────────────────────────────────────────────────────
export const generateSalt = (): Uint8Array =>
  crypto.getRandomValues(new Uint8Array(16));

export const toB64 = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes));

export const fromB64 = (b64: string): Uint8Array =>
  Uint8Array.from(atob(b64), c => c.charCodeAt(0));

// ── PBKDF2 → AES-GCM-256 key derivation ──────────────────────────────────
export async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ── AES-GCM encrypt ────────────────────────────────────────────────────────
export async function encryptPayload(
  data: unknown,
  key: CryptoKey,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(data)),
  );
  return { ciphertext: toB64(new Uint8Array(buf)), iv: toB64(iv) };
}

// ── AES-GCM decrypt — throws on wrong key ─────────────────────────────────
export async function decryptPayload(
  ciphertext: string,
  iv: string,
  key: CryptoKey,
): Promise<unknown> {
  const buf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(iv) },
    key,
    fromB64(ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(buf));
}

// ── SHA-256 quick hash (kept for any non-auth utility use) ─────────────────
export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Salted PBKDF2 PIN hash + constant-time verify ──────────────────────────
// Used by the Screen Lock. PBKDF2 with 100k iterations + per-user salt makes
// brute forcing the 10K-entry PIN space costly (~hours on commodity hardware)
// instead of instant. The hash is stored alongside the salt; the raw PIN
// never leaves the device beyond the moment of entry.
export async function hashPinSalted(pin: string, saltB64: string): Promise<string> {
  const salt = fromB64(saltB64);
  const raw = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    raw,
    256,
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time string compare — prevents timing attacks even though the
// blast radius for a 4-digit PIN is tiny. Both inputs must be the same length.
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function newSaltB64(): string {
  return toB64(generateSalt());
}
