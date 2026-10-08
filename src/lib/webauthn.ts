// WebAuthn (Passkey / Touch ID / Face ID) helpers for the Screen Lock.
//
// We don't run a relying-party server, so we treat WebAuthn as a LOCAL device
// unlock — the credential is created with `userVerification: required` and
// stored as a credentialId in the user's profile/localStorage. Successful auth
// just means "the same device's biometric / platform authenticator approved",
// which we then use to allow PIN bypass.
//
// This is NOT a replacement for the PIN — it's a convenience layer on top of it.
// The PIN remains the recovery path when biometrics aren't enrolled or fail.

const CRED_KEY_PREFIX = 'pocket-cfo-webauthn-cred-';

function credKey(userId: string): string { return `${CRED_KEY_PREFIX}${userId}`; }

// A credential belongs to the exact host it was created on, so one enrolled at
// www.example.com is invisible at example.com and vice versa. Naming the
// registrable domain explicitly makes the two share. Only the "www." prefix is
// stripped: rp.id has to be a suffix of the current host, and anything more
// aggressive would throw on localhost or inside the native shell.
function relyingPartyId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const host = window.location.hostname;
  return host.startsWith('www.') ? host.slice(4) : undefined;
}

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof window.PublicKeyCredential !== 'undefined'
    && typeof navigator.credentials !== 'undefined';
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

export function hasEnrolledCredential(userId: string): boolean {
  try { return !!localStorage.getItem(credKey(userId)); }
  catch { return false; }
}

export function clearEnrolledCredential(userId: string): void {
  try { localStorage.removeItem(credKey(userId)); } catch {}
}

function b64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64UrlDecode(b64: string): ArrayBuffer {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(b64.length + (4 - b64.length % 4) % 4, '=');
  const str = atob(padded);
  const buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i);
  return buf.buffer;
}

// Enroll a platform-bound credential for this user. The challenge is a random
// 32-byte buffer; since we don't verify it server-side, replay-prevention here
// is "the credential is locked to this device and requires biometric verification."
export async function enrollCredential(userId: string, displayName: string): Promise<void> {
  if (!isWebAuthnSupported()) throw new Error('WebAuthn not supported in this browser');

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(userId);

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'StackPiggy', id: relyingPartyId() },
      user: {
        id:          userIdBytes,
        name:        displayName || 'StackPiggy User',
        displayName: displayName || 'StackPiggy User',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',  // Built-in biometric only
        userVerification:        'required',
        residentKey:             'preferred',
      },
      timeout:    60_000,
      attestation: 'none',
    },
  }) as PublicKeyCredential | null;

  if (!credential) throw new Error('Credential creation returned null');

  // Store the credentialId so we can request the same authenticator next time.
  localStorage.setItem(credKey(userId), b64UrlEncode(credential.rawId));
}

// Prompt the user to verify with their platform authenticator. Returns true on
// successful assertion, false on rejection / cancellation / unavailability.
export async function verifyCredential(userId: string): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  const stored = (() => { try { return localStorage.getItem(credKey(userId)); } catch { return null; } })();
  if (!stored) return false;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: relyingPartyId(),
        allowCredentials: [{ type: 'public-key', id: b64UrlDecode(stored) }],
        userVerification: 'required',
        timeout:          60_000,
      },
    });
    return !!assertion;
  } catch (err) {
    // A credential enrolled on a different domain cannot be used here and never
    // will be, so the stored reference is dead weight that leaves the unlock
    // button failing forever. Forget it and let the user enrol again. A plain
    // cancellation reports NotAllowedError and must keep its credential.
    const name = (err as { name?: string } | null)?.name;
    if (name === 'InvalidStateError' || name === 'SecurityError') {
      try { localStorage.removeItem(credKey(userId)); } catch { /* storage unavailable */ }
    }
    return false;
  }
}
