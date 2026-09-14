import { isNative } from './native/platform';
﻿import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App.tsx';
import './index.css';

// A production preview can leave a service worker controlling localhost. Vite's
// development server does not install one, so remove any existing registrations
// and their caches before they can keep serving an older interface during local
// testing.
if (import.meta.env.DEV && !isNative && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
    if (registrations.length === 0) return;

    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }

    // The current document can remain under the removed worker's control until
    // it reloads. Reload once so localhost immediately uses Vite's current files.
    const reloadKey = 'pocketcfo-dev-worker-cleared';
    if (navigator.serviceWorker.controller && sessionStorage.getItem(reloadKey) !== '1') {
      sessionStorage.setItem(reloadKey, '1');
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {!isNative && <Analytics />}
    {!isNative && <SpeedInsights />}
  </StrictMode>,
);
