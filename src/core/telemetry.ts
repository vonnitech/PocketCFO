// Event definitions and sink. Product events reach PostHog when VITE_POSTHOG_KEY
// is configured; without it nothing leaves the browser. Security events stay
// local by design (see logSecurityEvent). Financial values are removed before
// any event is logged or sent, so neither DevTools, captured console logs, nor
// the analytics provider can see account balances or reserved bill amounts.

import { captureEvent } from './analytics';

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

export function logSecurityEvent(event: SecurityEvent): void {
  if (!import.meta.env.DEV) return;
  const payload = { ...event, ts: new Date().toISOString() };
  // eslint-disable-next-line no-console
  console.warn('[security]', payload);
  // Deliberately not forwarded to analytics. These describe a named user's
  // authentication behaviour (lockouts, failed unlocks, forced signouts), which
  // is more sensitive than funnel data and is not what the funnel is for. Wire
  // them to an error reporter if they are ever needed in production.
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
  // safeSpend and billsReserved are the user's actual money. They are dropped
  // here, before the event reaches the console or the analytics provider, so
  // amounts never leave the device. daysUntilPayday and billCount are kept:
  // they make the funnel readable without exposing balances.
  const payload: Record<string, unknown> = { ts: new Date().toISOString() };
  for (const [key, value] of Object.entries(event)) {
    if (key !== 'safeSpend' && key !== 'billsReserved') payload[key] = value;
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn('[product]', payload);
  }
  captureEvent(`product:${event.type}`, payload);
}
