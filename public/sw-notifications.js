/* eslint-env serviceworker */
/* global clients */

// Service worker additions for notifications.
//
// Pulled into the generated Workbox service worker via `workbox.importScripts`
// in vite.config.ts. It lives in public/ (not src/) because it has to be a plain
// script served at a stable URL that importScripts can fetch at SW install time.
//
// Keep this file dependency-free and defensive. A throw in here fails the whole
// service worker install, which would take offline support down with it.

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const data = event.notification.data || {};
  const path = typeof data.path === 'string' && data.path.startsWith('/') ? data.path : '/';
  const target = new URL(path, self.location.origin).href;

  // Focus an existing tab rather than opening a second copy of the app. Someone
  // who already has Pocket CFO open should be moved to the right screen, not
  // handed a duplicate window.
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        if ('navigate' in client && 'focus' in client) {
          return client.navigate(target).then(c => (c || client).focus());
        }
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow ? clients.openWindow(target) : undefined;
    }).catch(() => {}),
  );
});

// ── Closed-app push lands here ───────────────────────────────────────────────
//
// When the server side is built (VAPID keys, a push_subscriptions table, and a
// scheduled function that runs the same rules), this is the only client code
// that needs adding. The payload shape is already the one `engine.ts` emits:
//
//   self.addEventListener('push', event => {
//     const record = event.data ? event.data.json() : null;
//     if (!record) return;
//     event.waitUntil(self.registration.showNotification(record.title, {
//       body: record.body,
//       icon: '/icon-192x192.png',
//       badge: '/icon-192x192.png',
//       tag: record.dedupeKey,
//       data: { path: record.actionPath || '/', recordId: record.id },
//     }));
//   });
//
// The policy gates (quiet hours, 1/day, 3/week, 48h dedupe) must run on the
// SERVER before a push is sent, not here. A push that arrives has already been
// decided; suppressing it at this point would waste the send and leave the
// client and server budgets disagreeing about what the user was told.
