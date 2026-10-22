// =========================================================================
// Browser notification permission and OS-level delivery.
//
// The only file in the module that touches browser APIs, so everything else
// stays pure and portable. Two rules enforced here:
//
//   1. requestPermission() is never called except from a real user gesture on
//      an explicit allow button. The soft primer exists precisely so the
//      one-shot browser prompt is spent on someone who has already said yes.
//   2. Delivery prefers the service worker registration. `new Notification()`
//      throws outright on Android Chrome and in installed PWAs, so the SW path
//      is the real one and the constructor is only a desktop fallback.
// =========================================================================

import type { NotificationRecord } from './types';

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

// The phone app's web view has no web notifications, so the native shell plugs
// the OS in here (src/native/localNotifications.ts). Kept as an injected object
// rather than an import so this module stays free of Capacitor and the verify
// script can keep running it in plain Node.
export interface NativeNotifier {
  // Cached, because the OS answers asynchronously; the shell refreshes it.
  permission(): PermissionState;
  request(): Promise<PermissionState>;
  show(payload: DeliverPayload): Promise<boolean>;
}
let native: NativeNotifier | null = null;

export function setNativeNotifier(notifier: NativeNotifier | null): void {
  native = notifier;
}

export function isSupported(): boolean {
  if (native) return true;
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function permissionState(): PermissionState {
  if (native) return native.permission();
  if (!isSupported()) return 'unsupported';
  const p = Notification.permission;
  return p === 'granted' || p === 'denied' ? p : 'default';
}

// Call from a click handler only. Resolves to the state after the user answers;
// a dismissed prompt stays 'default', which the caller must treat as a no.
export async function requestPermission(): Promise<PermissionState> {
  if (native) return native.request();
  if (!isSupported()) return 'unsupported';
  try {
    // Safari below 16 only supports the callback form, hence the tolerance.
    const result = await Notification.requestPermission();
    return result === 'granted' || result === 'denied' ? result : 'default';
  } catch {
    return permissionState();
  }
}

// ── Delivery ─────────────────────────────────────────────────────────────────

const ICON  = '/icon-192x192.png';
const BADGE = '/icon-192x192.png';

export interface DeliverPayload {
  title: string;
  body: string;
  tag: string;
  path?: string;
  recordId?: string;
}

async function deliver(payload: DeliverPayload): Promise<boolean> {
  if (permissionState() !== 'granted') return false;
  if (native) return native.show(payload);

  const options: NotificationOptions & { renotify?: boolean } = {
    body: payload.body,
    icon: ICON,
    badge: BADGE,
    // Tagging by dedupeKey means a repeat of the same nudge REPLACES the old
    // one in the tray instead of stacking a second copy on top of it.
    tag: payload.tag,
    renotify: false,
    data: { path: payload.path ?? '/', recordId: payload.recordId },
  };

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) {
      await reg.showNotification(payload.title, options);
      return true;
    }
  } catch {
    // Fall through to the constructor below.
  }

  try {
    // eslint-disable-next-line no-new
    new Notification(payload.title, options);
    return true;
  } catch {
    // Android Chrome and installed PWAs land here when no SW is registered.
    // The record is already in the inbox, so nothing is lost.
    return false;
  }
}

export function deliverRecord(record: NotificationRecord): Promise<boolean> {
  return deliver({
    title: record.title,
    body: record.body,
    tag: record.dedupeKey,
    path: record.actionPath,
    recordId: record.id,
  });
}

// Fired by the "Send a test" button in Settings so a user can confirm that
// notifications actually reach their device before relying on them. Bypasses
// the rules engine entirely: it is user-initiated, so no budget applies.
export function deliverTest(): Promise<boolean> {
  return deliver({
    title: 'Notifications are working',
    body: 'This is what a StackPiggy alert looks like. Real ones only arrive when something about your money needs you.',
    tag: 'pocketcfo-test',
    path: '/settings',
  });
}
