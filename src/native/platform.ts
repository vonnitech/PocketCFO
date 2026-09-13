import { Capacitor, CapacitorHttp } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const NATIVE_AUTH_REDIRECT = 'app.pocketcfo.mobile://auth/callback';
export const authRedirectUrl = () => isNative ? NATIVE_AUTH_REDIRECT : window.location.origin;

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
