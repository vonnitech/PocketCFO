// Lightweight security/observability event sink. Today it writes to console.warn
// so the events surface in DevTools and Sentry breadcrumbs once Sentry is wired.
// Swap the implementation when you adopt PostHog / Sentry / a custom endpoint
// without touching the call sites.

export type SecurityEvent =
  | { type: 'pin.lockout';      attempts: number; cooldownSec: number }
  | { type: 'pin.force_signout'; attempts: number }
  | { type: 'pin.weak_rejected'; reason: string }
  | { type: 'pin.changed' }
  | { type: 'pin.created' }
  | { type: 'webauthn.enrolled' }
  | { type: 'webauthn.unlock_ok' }
  | { type: 'webauthn.unlock_fail'; reason: string }
  | { type: 'idle.locked'; idleMs: number };

let userIdRef: string | null = null;
export function setTelemetryUser(userId: string | null): void { userIdRef = userId; }

export function logSecurityEvent(event: SecurityEvent): void {
  const payload = { ...event, userId: userIdRef, ts: new Date().toISOString() };
  // eslint-disable-next-line no-console
  console.warn('[security]', payload);
  // TODO when Sentry/PostHog is wired:
  //   Sentry.addBreadcrumb({ category: 'security', level: 'warning', message: event.type, data: payload });
  //   posthog.capture(`security:${event.type}`, payload);
}
