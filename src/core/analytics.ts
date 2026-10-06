// PostHog sink for the product funnel defined in telemetry.ts.
//
// Analytics is off unless VITE_POSTHOG_KEY is set, so development, tests, and
// any deployment without the key behave exactly as before: events go to the
// console in dev and nowhere else. Adding the key is the only step needed to
// turn collection on.
//
// Capture settings are deliberately restrictive. This is a personal finance
// app, so anything that records the page itself would sweep up balances, bill
// amounts and vault targets. Autocapture and session recording are therefore
// both disabled: only the events this codebase raises by hand are sent, and
// those are filtered in telemetry.ts before they reach here.

import type { PostHog } from 'posthog-js';

let client: PostHog | null = null;

// The SDK is fetched asynchronously, so events raised during the first moments
// of a session would otherwise be dropped. Holding them until the client is
// ready keeps the start of the funnel intact, which is precisely the part
// worth measuring. Capped so a client that never arrives cannot grow this
// without limit.
const MAX_PENDING = 50;
let pending: Array<[string, Record<string, unknown>]> = [];
let loading = false;

export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key || client || loading) return;
  loading = true;

  // Region matters: a key from a US project sent to the EU host records nothing,
  // and fails quietly. Override via VITE_POSTHOG_HOST for an EU project.
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  // Loaded on demand so the SDK stays out of the bundle's critical path and
  // never runs at all for deployments without a key.
  void import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: host,
        // No automatic DOM capture. Every event is raised explicitly.
        autocapture: false,
        // No session replay. Replay would record on-screen financial figures.
        disable_session_recording: true,
        // Page views are sent by PageviewTracker instead, so that in-app
        // navigation is recorded and not just the first load.
        capture_pageview: false,
        // Needed for time-on-page and bounce rate in Web Analytics.
        capture_pageleave: true,
        capture_performance: false,
        // Crashes and rejected promises are reported. Console capture stays off:
        // this codebase logs Supabase responses and telemetry payloads to the
        // console, and none of that should leave the device just because it was
        // printed. Thrown errors here use fixed messages, so stack traces carry
        // code paths rather than anyone's figures.
        capture_exceptions: {
          capture_unhandled_errors: true,
          capture_unhandled_rejections: true,
          capture_console_errors: false,
        },
        // Without an identify() call this keeps events pseudonymous: they are
        // tied to a browser, not to an account.
        person_profiles: 'identified_only',
      });
      client = posthog;
      const queued = pending;
      pending = [];
      for (const [name, properties] of queued) captureEvent(name, properties);
    })
    .catch(() => {
      // Blocked by an extension, offline, or a bad key. Analytics stays off and
      // anything queued is discarded rather than held for the whole session.
      pending = [];
    });
}

export function captureEvent(name: string, properties: Record<string, unknown> = {}): void {
  if (!client) {
    if (loading && pending.length < MAX_PENDING) pending.push([name, properties]);
    return;
  }
  try {
    client.capture(name, properties);
  } catch {
    // Reporting an event is never worth interrupting what the user is doing.
  }
}

// Routes in this app are static and carry no account identifiers, so the path
// is safe to record. PostHog reads the current URL itself at capture time.
export function capturePageview(): void {
  captureEvent('$pageview');
}
