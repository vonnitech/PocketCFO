export type NativeDestination = { type: 'auth'; code: string } | { type: 'spend' } | { type: 'home' };

export function parseNativeLink(value: string): NativeDestination | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'app.pocketcfo.mobile:' || url.username || url.password || url.port) return null;
    if (url.host === 'auth' && url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      return code ? { type: 'auth', code } : null;
    }
    if (url.host === 'spend' && (url.pathname === '' || url.pathname === '/')) return { type: 'spend' };
    if (url.host === 'home' && (url.pathname === '' || url.pathname === '/')) return { type: 'home' };
  } catch { /* Unrecognized URLs never navigate the WebView. */ }
  return null;
}
