// Phone notifications for the app build.
//
// The web view the app runs in has no web notifications, so this plugs the OS
// into the notification engine through two seams it already exposes:
//   - setNativeNotifier: permission checks, the permission prompt, and alerts
//     shown immediately (the app is open when they are raised)
//   - setOsScheduler: the week of calendar-driven alerts that projection.ts
//     books ahead, so bills, payday and the daily review still arrive while
//     the app is closed
//
// Nothing here decides WHAT to send or WHEN; the engine and its caps do. This
// file only talks to the OS.

import { App as NativeApp } from '@capacitor/app';
import { LocalNotifications, type PermissionStatus } from '@capacitor/local-notifications';
import {
  refreshFromOs,
  setNativeNotifier,
  setOsScheduler,
  type DeliverPayload,
  type PermissionState,
  type ScheduledAlert,
} from '../core/notifications';
import { osIdFor } from '../core/notifications/projection';

const toState = (s: PermissionStatus): PermissionState =>
  s.display === 'granted' ? 'granted' : s.display === 'denied' ? 'denied' : 'default';

// Opens the route a notification points at, the same way deep links do.
function openPath(path: unknown): void {
  const target = typeof path === 'string' && path.startsWith('/') ? path : '/';
  window.history.pushState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Installs phone notifications. Returns a cleanup function. */
export function installLocalNotifications(): () => void {
  // 'default' until the OS answers; nothing is shown or booked before then.
  let permission: PermissionState = 'default';

  const refreshPermission = async () => {
    try {
      const next = toState(await LocalNotifications.checkPermissions());
      if (next === permission) return;
      permission = next;
      refreshFromOs();
    } catch {
      // Plugin unavailable on this build: stay at 'default' (inbox only).
    }
  };

  setNativeNotifier({
    permission: () => permission,
    request: async () => {
      try {
        permission = toState(await LocalNotifications.requestPermissions());
      } catch {
        // Treated as not granted. The inbox keeps working either way.
      }
      refreshFromOs();
      return permission;
    },
    show: async (payload: DeliverPayload) => {
      try {
        // Same dedupe tag, same id: a repeat replaces the earlier one in the
        // tray instead of stacking a second copy, as on the web.
        await LocalNotifications.schedule({
          notifications: [{
            id: osIdFor(`now:${payload.tag}`),
            title: payload.title,
            body: payload.body,
            extra: { path: payload.path ?? '/' },
          }],
        });
        return true;
      } catch {
        return false;
      }
    },
  });

  // Serialised so two quick re-plans can never interleave a cancel and a book.
  let queue = Promise.resolve();
  setOsScheduler({
    book: (plan: ScheduledAlert[]) => {
      queue = queue.then(async () => {
        try {
          const pending = await LocalNotifications.getPending();
          if (pending.notifications.length > 0) {
            await LocalNotifications.cancel({
              notifications: pending.notifications.map(n => ({ id: n.id })),
            });
          }
          if (plan.length === 0) return;
          await LocalNotifications.schedule({
            notifications: plan.map(p => ({
              id: p.osId,
              title: p.record.title,
              body: p.record.body,
              // allowWhileIdle so Android's battery saver does not hold a bill
              // reminder until the phone is next picked up.
              schedule: { at: new Date(p.at), allowWhileIdle: true },
              extra: { path: p.record.actionPath ?? '/' },
            })),
          });
        } catch {
          console.warn('[notifications] Could not book phone alerts.');
        }
      });
      return queue;
    },
  });

  const tapListener = LocalNotifications.addListener('localNotificationActionPerformed', action => {
    openPath(action.notification.extra?.path);
  });
  // Permission can change in the phone's settings while the app is in the
  // background, so it is re-read whenever the app comes back.
  const resumeListener = NativeApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void refreshPermission();
  });
  void refreshPermission();

  return () => {
    setOsScheduler(null);
    setNativeNotifier(null);
    for (const listener of [tapListener, resumeListener]) {
      void listener.then(handle => handle.remove());
    }
  };
}
