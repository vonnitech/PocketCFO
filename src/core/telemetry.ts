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

// Product/funnel events. Same sink as security events; swap the body when analytics
// is wired. `feature` is the gated tool key (e.g. 'fire', 'income', 'debt').
//
// The activation funnel runs in order:
//   signup -> onboarding_started -> onboarding_step -> safe_spend_generated
//   -> activation_completed
// A user who signs up but never reaches safe_spend_generated has not seen the
// number the product is sold on, so that drop-off is the one worth watching.
export type ProductEvent =
  | { type: 'paywall_viewed';      feature: string }
  | { type: 'paywall_cta_clicked'; feature: string }
  // Submitted and created are separate so a signup that FAILS (duplicate email,
  // rejected password) is visible as submitted-without-created, rather than
  // silently missing from the funnel.
  //
  // Google is recorded as intent only: at the point of redirect a Google click is
  // indistinguishable from a Google login, so it is logged when the user is on the
  // signup tab and never gets a matching signup_created.
  | { type: 'signup_submitted';    method: 'password' | 'google' }
  // `autoSignedIn` is false when the user is held at the login screen pending
  // email confirmation, which blocks them from reaching a Safe-to-Spend number
  // in the same session.
  | { type: 'signup_created';      method: 'password'; autoSignedIn: boolean }
  | { type: 'onboarding_started' }
  | { type: 'onboarding_step';     step: 'basics' | 'bills'; billCount?: number }
  // Fired the moment the user is first shown a real Safe-to-Spend figure derived
  // from their own numbers, before they commit. Fires on the preview itself, not
  // at submit, so that people who see the number and then abandon are countable.
  | { type: 'safe_spend_previewed'; safeSpend: number; daysUntilPayday: number; billsReserved: number }
  // Fired once the profile write succeeds and the app is usable.
  | { type: 'activation_completed'; safeSpend: number; daysUntilPayday: number; billsReserved: number; billCount: number }
  // Fired when the user commits to paying, before the redirect to LemonSqueezy.
  | { type: 'payment_intent';      plan: 'monthly' | 'annual' | 'lifetime' };

export function logProductEvent(event: ProductEvent): void {
  const payload = { ...event, userId: userIdRef, ts: new Date().toISOString() };
  // eslint-disable-next-line no-console
  console.warn('[product]', payload);
  // TODO when PostHog is wired: posthog.capture(`product:${event.type}`, payload);
}
