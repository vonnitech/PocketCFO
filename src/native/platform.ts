import { Capacitor, CapacitorHttp } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const NATIVE_AUTH_REDIRECT = 'app.pocketcfo.mobile://auth/callback';
export const authRedirectUrl = () => isNative ? NATIVE_AUTH_REDIRECT : window.location.origin;

const AUTH_QUERY_KEYS = [
  'code', 'token', 'token_hash', 'access_token', 'refresh_token',
  'error', 'error_code', 'error_description', 'type',
];

/** Remove one-time auth material after the Supabase client has consumed it. */
export function clearAuthCallbackUrl(): void {
  if (isNative || typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const isCallback = url.pathname === '/auth/callback';
  let changed = isCallback;

  for (const key of AUTH_QUERY_KEYS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }

  if (url.hash.length > 1) {
    const hashParams = new URLSearchParams(url.hash.slice(1));
    if (AUTH_QUERY_KEYS.some(key => hashParams.has(key))) {
      url.hash = '';
      changed = true;
    }
  }

  if (!changed) return;
  const safePath = isCallback ? '/' : url.pathname;
  window.history.replaceState({}, '', `${safePath}${url.search}${url.hash}`);
}

// Native assets run on localhost. Server functions still run on the deployed
// HTTPS backend. Native HTTP avoids broadly opening the server's CORS policy.
export async function postAccountApi(path: string, token: string): Promise<{ ok: boolean; error?: string }> {
  if (!isNative) {
    const response = await fetch(path, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    return { ...body, ok: response.ok };
  }
  const origin = import.meta.env.VITE_NATIVE_API_ORIGIN as string | undefined;
  if (!origin || new URL(origin).protocol !== 'https:') {
    throw new Error('Account services are not configured in this build.');
  }
  const response = await CapacitorHttp.post({
    url: new URL(path, origin).href,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {},
  });
  return { ...response.data, ok: response.status >= 200 && response.status < 300 };
}
