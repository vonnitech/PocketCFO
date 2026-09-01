// =========================================================================
// Sync health signal.
//
// A leaf module on purpose: `core/sync.ts` imports it, and the notification
// rules read it, so it must not import either of them or the graph cycles.
// State is in-memory only. A sync problem that did not survive a reload is not
// a problem worth telling anyone about.
// =========================================================================

// Failures older than this stop counting. A blip an hour ago is not evidence
// that saving is broken now.
const WINDOW_MS = 30 * 60 * 1000;

// One failure is a dropped packet. Two inside the window is a pattern.
const FAILURE_THRESHOLD = 2;

// If the most recent failure is older than this, whatever went wrong has
// probably resolved itself and we say nothing.
const RECENCY_MS = 10 * 60 * 1000;

let failures: number[] = [];

// `at` is injectable so the rule can be exercised against a fixed clock. Never
// pass it a promise rejection reason: call sites must wrap rather than hand this
// straight to `.then(onOk, onErr)`, or the error object lands in the timestamp.
export function recordSyncFailure(at: number = Date.now()): void {
  failures = failures.filter(t => at - t < WINDOW_MS);
  failures.push(at);
}

// Cleared whenever a write succeeds, so a single good save cancels the warning.
export function recordSyncSuccess(): void {
  failures = [];
}

export interface SyncHealth {
  failing: boolean;
  failureCount: number;
}

export function readSyncHealth(now: number = Date.now()): SyncHealth {
  const recent = failures.filter(t => now - t < WINDOW_MS);
  const last   = recent[recent.length - 1];
  const failing =
    recent.length >= FAILURE_THRESHOLD &&
    last !== undefined &&
    now - last < RECENCY_MS;
  return { failing, failureCount: recent.length };
}

// Test seam. Not called by app code.
export function __resetSyncHealth(): void {
  failures = [];
}
