/**
 * Verification harness for the notification system.
 *
 *   npx tsx scripts/verify-notifications.ts
 *
 * The project has no test runner, so this is a plain script rather than a suite.
 * It exercises the pure parts of the system (policy gates, rules, the evaluate()
 * selection, and the onboarding permission branch) against fixed clocks and a
 * stubbed localStorage, and exits non-zero on any failure.
 *
 * It deliberately does NOT touch React. Everything asserted here is logic that
 * can also run server-side, which is the same property that makes closed-app
 * push a transport change rather than a rewrite.
 */

// ── Browser stubs, installed before any module import ────────────────────────

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

let notificationPermission: 'default' | 'granted' | 'denied' = 'default';

(globalThis as any).localStorage = new MemoryStorage();
(globalThis as any).window = globalThis;
// Counts constructions so a test can assert that NOTHING reached the device.
// deliver() tries the service worker first, finds none in Node, and falls
// through to this constructor, so it is the OS-delivery counter.
let osDeliveries = 0;
(globalThis as any).Notification = class {
  static get permission() { return notificationPermission; }
  static requestPermission() { return Promise.resolve(notificationPermission); }
  constructor() { osDeliveries++; }
};

const { evaluate, tick, setMode, initForUser, subscribeToEmissions, getRecords } =
  await import('../src/core/notifications/engine');
const { defaultLog, defaultPrefs, loadPrefs, savePrefs } = await import('../src/core/notifications/storage');
const { isQuietHour, budgetUsage, POLICY } = await import('../src/core/notifications/policy');
const { permissionState } = await import('../src/core/notifications/permission');
const { recordSyncFailure, __resetSyncHealth } = await import('../src/core/notifications/health');
type Slice = import('../src/core/notifications/rules').NotificationStateSlice;
type Log = import('../src/core/notifications/types').NotificationLogState;
type Prefs = import('../src/core/notifications/types').NotificationPrefs;

// ── Tiny assertion harness ───────────────────────────────────────────────────

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) { passed++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ` :: ${detail}` : ''}`); }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const at = (iso: string) => new Date(iso);

// A Tuesday, 7pm local. Late enough for the Daily Review window, outside quiet
// hours, so rules that depend on the clock are all reachable from one baseline.
const EVENING = at('2026-09-01T19:00:00');

const tx = (over: Partial<{ merchant: string; amount: number; category: string; date: string; isFlip: boolean; flipAmount: number }> = {}) => ({
  id: Math.random().toString(36).slice(2),
  merchant: 'SHOP',
  amount: 10,
  category: 'OTHER',
  date: '2026-09-01T12:00:00',
  isFlip: false,
  flipAmount: 0,
  ...over,
});

function slice(over: Partial<Slice> = {}): Slice {
  return {
    isConfigured: true,
    hasCompletedOnboarding: true,
    monthlyTakeHome: 3000,
    safeSpendLimit: 40,
    liquidAssets: 1200,
    upcomingBills: 0,
    nextPayday: '2026-09-25',
    billQueue: [],
    subscriptions: [],
    transactions: [],
    reconHistory: [],
    ...over,
  };
}

const prefsWith = (over: Partial<Prefs> = {}): Prefs => ({ ...defaultPrefs(), ...over });
const allOn = () => prefsWith({ mode: 'all' });

// Emits once and returns [records, nextLog] so chains read cleanly.
function run(s: Slice, p: Prefs, l: Log, now: Date) {
  const r = evaluate(s, p, l, now);
  return { records: r.records, log: r.nextLog };
}

// Holding an overspend warning releases the day's single slot to whatever is
// next in priority, which is usually the Daily Review reminder. So "the warning
// was held" is a claim about the overspend category, not about silence.
const overspend = (r: { records: { category: string }[] }) =>
  r.records.filter(x => x.category === 'overspend');

// =============================================================================
section('1. Onboarding permission branch');
// The gate the onboarding modal uses:
//   ask = permissionState() === 'default' && prefs.primer === 'unasked'
// =============================================================================

function shouldAskInOnboarding(userId: string): boolean {
  return permissionState() === 'default' && loadPrefs(userId).primer === 'unasked';
}

{
  // (a) Fresh user, browser has not been asked. The step should appear.
  notificationPermission = 'default';
  check('undecided + never asked -> onboarding SHOWS the step', shouldAskInOnboarding('u-fresh') === true);

  // (b) Already granted (reinstall, or another tab enabled it). Asking again is
  //     a dead step, so it is skipped.
  notificationPermission = 'granted';
  check('already granted -> onboarding SKIPS the step', shouldAskInOnboarding('u-granted') === false);

  // (c) Denied. Script cannot re-prompt; showing the ask would be a lie.
  notificationPermission = 'denied';
  check('denied -> onboarding SKIPS the step', shouldAskInOnboarding('u-denied') === false);

  // (d) Dismissed previously ("Not now"). The primer recorded the answer, so it
  //     never auto-appears again even though permission is still 'default'.
  notificationPermission = 'default';
  savePrefs(prefsWith({ primer: 'dismissed', primerAnsweredAt: EVENING.toISOString() }), 'u-dismissed');
  check('dismissed before -> onboarding SKIPS the step (no nagging)', shouldAskInOnboarding('u-dismissed') === false);

  // (e) Accepted previously but permission was later revoked in browser settings.
  //     Still not re-asked automatically; Settings is the way back in.
  savePrefs(prefsWith({ primer: 'accepted' }), 'u-accepted');
  check('accepted before -> onboarding SKIPS the step', shouldAskInOnboarding('u-accepted') === false);

  // (f) Preferences are per-user, so one account's answer cannot silence another.
  check('primer state is scoped per user', loadPrefs('u-fresh').primer === 'unasked');

  notificationPermission = 'default';
}

// =============================================================================
section('2. Quiet hours (21:00 to 08:00 local)');
// =============================================================================
{
  const q = { start: 21, end: 8 };
  check('20:59 is not quiet',      isQuietHour(at('2026-09-01T20:59:00'), q) === false);
  check('21:00 is quiet',          isQuietHour(at('2026-09-01T21:00:00'), q) === true);
  check('02:00 is quiet (wraps midnight)', isQuietHour(at('2026-09-01T02:00:00'), q) === true);
  check('07:59 is quiet',          isQuietHour(at('2026-09-01T07:59:00'), q) === true);
  check('08:00 is not quiet',      isQuietHour(at('2026-09-01T08:00:00'), q) === false);
}

// =============================================================================
section('3. Throttling');
// =============================================================================
{
  // Two things are simultaneously true: overspend today AND a bill due tomorrow.
  const busy = slice({
    safeSpendLimit: 40,
    transactions: [tx({ amount: 90 })],
    billQueue: [{ id: 'b1', name: 'Rent', amount: 800, dueDay: 2 }],
  });

  const first = run(busy, allOn(), defaultLog(), EVENING);
  check('several truths at once still emit only ONE nudge', first.records.length === 1,
    `got ${first.records.length}`);
  check('the highest-priority truth wins (overspend over bills)',
    first.records[0]?.ruleId === 'overspend-today', first.records[0]?.ruleId);

  // Same day, minutes later. The daily cap must hold.
  const second = run(busy, allOn(), first.log, at('2026-09-01T19:30:00'));
  check('daily cap blocks a second nudge the same day', second.records.length === 0);

  // Next day. The bill is still due and overspend is on a 48h cooldown, so the
  // bill nudge is what gets through.
  const day2 = run(
    slice({ safeSpendLimit: 40, billQueue: [{ id: 'b1', name: 'Rent', amount: 800, dueDay: 3 }] }),
    allOn(), first.log, at('2026-09-02T19:00:00'),
  );
  check('next day, a different nudge is allowed through', day2.records.length === 1);
  check('the repeat of the SAME nudge is suppressed for 48h',
    day2.records[0]?.ruleId !== 'overspend-today', day2.records[0]?.ruleId);

  // Weekly cap: three proactive records already this week, a fourth is refused.
  const stamps = ['2026-08-30T10:00:00', '2026-08-31T10:00:00', '2026-09-01T10:00:00'];
  const weekLog: Log = {
    ...defaultLog(),
    records: stamps.map((s, i) => ({
      id: `r${i}`, dedupeKey: `k${i}`, ruleId: 'bill-due-soon' as const, category: 'bills' as const,
      level: 'important' as const, title: 't', body: 'b', createdAt: new Date(s).toISOString(),
      readAt: null, deliveredOs: false, origin: 'client' as const,
    })),
  };
  const usage = budgetUsage(weekLog, at('2026-09-02T19:00:00'));
  check('week usage counts the rolling 7 days', usage.week === 3, String(usage.week));
  const capped = run(
    slice({ safeSpendLimit: 40, transactions: [tx({ amount: 90, date: '2026-09-02T12:00:00' })] }),
    allOn(), weekLog, at('2026-09-02T19:00:00'),
  );
  check(`weekly cap of ${POLICY.maxPerWeek} blocks a 4th nudge`, capped.records.length === 0);

  // Same log, one day past the window edge. The oldest record ages out.
  const aged = run(
    slice({ safeSpendLimit: 40, transactions: [tx({ amount: 90, date: '2026-09-07T12:00:00' })] }),
    allOn(), weekLog, at('2026-09-07T19:00:00'),
  );
  check('once older records age out of the week, nudges resume', aged.records.length === 1);
}

// =============================================================================
section('4. Mode and category gates');
// =============================================================================
{
  const reviewDue = slice({
    safeSpendLimit: 40,
    transactions: [tx({ amount: 12 })],
    reconHistory: [],
  });

  // Off is rejected by the FIRST gate, so nothing is even recorded. The Settings
  // hint and the bell both say so, and this is what holds them to it.
  const off = run(reviewDue, prefsWith({ mode: 'off' }), defaultLog(), EVENING);
  check('mode "off" sends nothing AND records nothing', off.records.length === 0);
  check('  so the inbox genuinely stays empty while off',
    off.log.records.length === 0, String(off.log.records.length));

  const important = run(reviewDue, prefsWith({ mode: 'important' }), defaultLog(), EVENING);
  check('mode "important only" filters out a helpful nudge', important.records.length === 0);

  const all = run(reviewDue, allOn(), defaultLog(), EVENING);
  check('mode "helpful too" lets the Daily Review nudge through', all.records.length === 1);
  check('  and it is the Daily Review one', all.records[0]?.ruleId === 'daily-review-due', all.records[0]?.ruleId);

  const catOff = prefsWith({ mode: 'all', categories: { ...defaultPrefs().categories, 'daily-review': false } });
  const muted = run(reviewDue, catOff, defaultLog(), EVENING);
  check('a muted category is dropped even in "helpful too"', muted.records.length === 0);
}

// =============================================================================
section('5. Structural suppression (completed action silences the rule)');
// =============================================================================
{
  const spent = slice({ safeSpendLimit: 40, transactions: [tx({ amount: 12 })] });

  const before = run(spent, allOn(), defaultLog(), EVENING);
  check('Daily Review nudge fires when today is unreviewed', before.records.length === 1);

  const reviewed = slice({
    safeSpendLimit: 40,
    transactions: [tx({ amount: 12 })],
    reconHistory: [{
      id: 'r1', date: '2026-09-01', rawSpend: 12, impulseSpend: 0, taxAmount: 0,
      surplus: 28, action: 'roll', tier: 'standard', tierMultiplier: 1, tierLimit: 40,
    }],
  });
  const after = run(reviewed, allOn(), defaultLog(), EVENING);
  check('reviewing today silences it with no separate mute flag', after.records.length === 0);

  // Nothing logged today means nothing to review, so no reminder either.
  const quiet = run(slice({ safeSpendLimit: 40 }), allOn(), defaultLog(), EVENING);
  check('no spending logged today -> no Daily Review nudge', quiet.records.length === 0);

  // Morning is too early for the evening reminder.
  const morning = run(spent, allOn(), defaultLog(), at('2026-09-01T09:00:00'));
  check('Daily Review nudge does not fire in the morning', morning.records.length === 0);

  // A paid bill leaves the queue, so the bill rule cannot see it.
  const paid = run(slice({ billQueue: [] }), allOn(), defaultLog(), EVENING);
  check('a paid bill is out of the queue, so no bill nudge', paid.records.length === 0);
}

// =============================================================================
section('6. Transactional account alerts bypass the budget');
// =============================================================================
{
  // The clock is injected so the health window lines up with the fixture time
  // rather than with real wall-clock time.
  __resetSyncHealth();
  recordSyncFailure(EVENING.getTime() - 60_000);
  recordSyncFailure(EVENING.getTime() - 30_000);

  // Budget already spent for the day and the week.
  const spentLog: Log = {
    ...defaultLog(),
    records: ['2026-08-30T10:00:00', '2026-08-31T10:00:00', '2026-09-01T10:00:00'].map((s, i) => ({
      id: `x${i}`, dedupeKey: `xk${i}`, ruleId: 'bill-due-soon' as const, category: 'bills' as const,
      level: 'important' as const, title: 't', body: 'b', createdAt: new Date(s).toISOString(),
      readAt: null, deliveredOs: false, origin: 'client' as const,
    })),
  };

  const out = run(slice(), allOn(), spentLog, EVENING);
  check('a real sync failure still gets through a spent budget', out.records.length === 1);
  check('  and it is the account alert', out.records[0]?.ruleId === 'account-sync-issue', out.records[0]?.ruleId);

  // It is still deduped, so a flapping connection cannot spam.
  const repeat = run(slice(), allOn(), out.log, at('2026-09-01T19:05:00'));
  check('the account alert is still deduped on its cooldown', repeat.records.length === 0);

  __resetSyncHealth();
  const healthy = run(slice(), allOn(), defaultLog(), EVENING);
  check('no failures -> no account alert', healthy.records.length === 0);
}

// =============================================================================
section('7. Safe-spend change baseline');
// =============================================================================
{
  // First sighting must be silent, otherwise a new user is told their number
  // "changed" from nothing.
  const seed = run(slice({ safeSpendLimit: 40 }), allOn(), defaultLog(), EVENING);
  check('first sighting of the daily number says nothing', seed.records.length === 0);
  check('  but the baseline is remembered', seed.log.memory['safe-spend:last-notified'] === 40);

  // A small move is not worth an interruption.
  const small = run(slice({ safeSpendLimit: 44 }), allOn(), seed.log, at('2026-09-02T19:00:00'));
  check('a 10% move is not worth interrupting anyone', small.records.length === 0);

  // A big move is. 40 -> 28 is a 30% drop, but still above the "critically low"
  // threshold (25% of a 3000/30 baseline = 25), so this isolates the shift rule.
  const big = run(slice({ safeSpendLimit: 28 }), allOn(), seed.log, at('2026-09-02T19:00:00'));
  check('a 30% drop does get reported', big.records.length === 1);
  check('  and it is the safe-spend change nudge',
    big.records[0]?.ruleId === 'safe-spend-shift', big.records[0]?.ruleId);
  check('  and the baseline advances to the reported value',
    big.log.memory['safe-spend:last-notified'] === 28,
    String(big.log.memory['safe-spend:last-notified']));

  // When the number is not just lower but critically low, the more urgent
  // warning outranks the "it changed" one. Both are true; only one is sent.
  const critical = run(slice({ safeSpendLimit: 20 }), allOn(), seed.log, at('2026-09-02T19:00:00'));
  check('a critically low number reports the risk, not the change',
    critical.records[0]?.ruleId === 'safe-spend-low', critical.records[0]?.ruleId);
  check('  and only one nudge is sent for the two overlapping truths',
    critical.records.length === 1);

  // Payday moves the number by design and the payday rule already covers it.
  const paydayDay = slice({
    safeSpendLimit: 95,
    transactions: [tx({ merchant: 'PAYDAY', category: 'INCOME', amount: 3000, date: '2026-09-01T12:00:00' })],
  });
  const onPayday = run(paydayDay, allOn(), seed.log, EVENING);
  check('payday is reported once, not twice',
    onPayday.records.length === 1 && onPayday.records[0]?.ruleId === 'payday-landed',
    onPayday.records.map(r => r.ruleId).join(','));
  check('  and the safe-spend baseline is resynced silently',
    onPayday.log.memory['safe-spend:last-notified'] === 95);
}

// =============================================================================
section('8. Persistence is user-scoped and corruption-proof');
// =============================================================================
{
  savePrefs(prefsWith({ mode: 'off' }), 'user-a');
  savePrefs(prefsWith({ mode: 'all' }), 'user-b');
  check('two accounts on one device keep separate prefs',
    loadPrefs('user-a').mode === 'off' && loadPrefs('user-b').mode === 'all');

  (globalThis as any).localStorage.setItem('pocket-cfo-notif-prefs-v1-user-c', '{ not json');
  check('corrupted prefs fall back to defaults instead of throwing',
    loadPrefs('user-c').mode === defaultPrefs().mode);

  (globalThis as any).localStorage.setItem('pocket-cfo-notif-prefs-v1-user-d', JSON.stringify({ version: 99, mode: 'all' }));
  check('prefs from a future version are discarded, not misread',
    loadPrefs('user-d').mode === defaultPrefs().mode);
}


// =============================================================================
section('9. Overspend escalation (severity-throttled, not time-throttled)');
// Reminders keep the flat 48h cooldown. Overspend warnings re-arm when the
// user's position materially worsens, because the product's whole promise is
// preventing a blown pay cycle.
//
// Fixture arithmetic: take-home 3000 -> a baseline day is 100. Severity is
// measured in days-under-water against that, on a roughly-doubling ladder.
// =============================================================================
{
  const D1 = at('2026-09-01T19:00:00');
  const D2 = at('2026-09-02T19:00:00');
  const D3 = at('2026-09-03T19:00:00');
  const D4 = at('2026-09-04T19:00:00');

  // 90 spent against a 40 limit: 50 over, half a baseline day.
  const over50  = (date: string) => slice({ safeSpendLimit: 40, transactions: [tx({ amount: 90, date })] });
  // 70 over. Worse in absolute terms, but the same rung of the ladder.
  const over70  = (date: string) => slice({ safeSpendLimit: 40, transactions: [tx({ amount: 110, date })] });
  // 190 over: nearly two baseline days. A real escalation.
  const over190 = (date: string) => slice({ safeSpendLimit: 40, transactions: [tx({ amount: 230, date })] });

  // --- crossing below zero for the first time -------------------------------
  const day1 = run(over50('2026-09-01T12:00:00'), allOn(), defaultLog(), D1);
  check('crossing past the daily number warns the first time', day1.records.length === 1);
  check('  and it is the overspend warning',
    day1.records[0]?.ruleId === 'overspend-today', day1.records[0]?.ruleId);

  // --- unchanged severity is held on the normal 48h -------------------------
  const day2Same = run(over50('2026-09-02T12:00:00'), allOn(), day1.log, D2);
  check('the SAME severity next day is held (48h still applies)', overspend(day2Same).length === 0,
    day2Same.records.map(r => r.ruleId).join(','));
  // The slot is not wasted: the next-best thing to say gets it instead.
  check('  and the freed slot goes to the next reminder in priority',
    day2Same.records[0]?.ruleId === 'daily-review-due', day2Same.records[0]?.ruleId);

  const day3Same = run(over50('2026-09-03T12:00:00'), allOn(), day1.log, D3);
  check('once 48h passes, an unchanged but still-bad state warns again',
    overspend(day3Same).length === 1);

  // --- a worsening that is not meaningful is still held ---------------------
  const day2Slight = run(over70('2026-09-02T12:00:00'), allOn(), day1.log, D2);
  check('a small worsening (50 -> 70 over) does NOT re-arm', overspend(day2Slight).length === 0,
    day2Slight.records.map(r => r.ruleId).join(','));

  // --- a meaningful worsening re-arms inside the cooldown -------------------
  const day2Worse = run(over190('2026-09-02T12:00:00'), allOn(), day1.log, D2);
  check('a meaningful worsening (50 -> 190 over) DOES re-arm inside 48h',
    overspend(day2Worse).length === 1);
  check('  and the copy says how much worse it got',
    overspend(day2Worse)[0]?.body.includes('Up from') === true, overspend(day2Worse)[0]?.body);

  // A second escalation at the same severity is held again, so worsening once
  // does not unlock unlimited warnings.
  const day3Worse = run(over190('2026-09-03T12:00:00'), allOn(), day2Worse.log, D3);
  check('after escalating, the new severity is itself held', overspend(day3Worse).length === 0,
    day3Worse.records.map(r => r.ruleId).join(','));

  // --- relapse: recovered, then a new transaction puts them back over -------
  const day2Clean = run(slice({ safeSpendLimit: 40 }), allOn(), day1.log, D2);
  check('a recovered day says nothing about overspend', overspend(day2Clean).length === 0);
  const day3Relapse = run(over50('2026-09-03T12:00:00'), allOn(), day2Clean.log, D3);
  check('recovering then going over again is a NEW event and warns',
    overspend(day3Relapse).length === 1);

  // --- new day while still high risk ----------------------------------------
  // Limit 20 against a baseline of 100 is under the 25% critical line.
  const thin = () => slice({ safeSpendLimit: 20 });
  const thinDay1 = run(thin(), allOn(), defaultLog(), D1);
  check('a critically thin daily number warns', overspend(thinDay1).length === 1);
  check('  and it is the safe-spend warning',
    thinDay1.records[0]?.ruleId === 'safe-spend-low', thinDay1.records[0]?.ruleId);
  const thinDay2 = run(thin(), allOn(), thinDay1.log, D2);
  check('a new day still at high risk re-arms even with no change',
    overspend(thinDay2).length === 1);
  const thinDay3 = run(thin(), allOn(), thinDay2.log, D3);
  check('  and again the day after', overspend(thinDay3).length === 1);
  const thinDay4 = run(thin(), allOn(), thinDay3.log, D4);
  check('  until the weekly cap of 3 stops it', thinDay4.records.length === 0);

  // Merely being over today is NOT high risk, so it does not re-arm daily.
  check('being over today alone does not re-arm daily', overspend(day2Same).length === 0);

  // --- level up: over budget becomes cannot-cover-bills ---------------------
  const shortfallToo = slice({
    safeSpendLimit: 40,
    liquidAssets: 500,
    upcomingBills: 900,
    transactions: [tx({ amount: 90, date: '2026-09-02T12:00:00' })],
  });
  const levelUp = run(shortfallToo, allOn(), day1.log, D2);
  check('crossing into a worse KIND of trouble re-arms', overspend(levelUp).length === 1);
  check('  and the copy leads with the shortfall',
    overspend(levelUp)[0]?.body.includes('more in bills than you have') === true,
    overspend(levelUp)[0]?.body);

  // --- the gap the old rule could not see -----------------------------------
  // safeSpendLimit is clamped at 0 by the math, so a 0 caused by a 400 shortfall
  // used to look identical to breaking even, and the old rule required > 0.
  const underwater = slice({ safeSpendLimit: 0, liquidAssets: 500, upcomingBills: 900 });
  const uw = run(underwater, allOn(), defaultLog(), D1);
  check('bills exceeding cash warns even though safe spend reads zero',
    uw.records.length === 1, 'got ' + uw.records.length);
  check('  and it names the gap',
    uw.records[0]?.body.includes('400') === true, uw.records[0]?.body);

  // --- global limits are never bypassed by escalation ------------------------
  const sameDayWorse = run(over190('2026-09-01T12:00:00'), allOn(), day1.log, at('2026-09-01T20:00:00'));
  check('escalation still cannot beat the 1-per-day cap', sameDayWorse.records.length === 0);

  const spentWeek: Log = {
    ...defaultLog(),
    records: ['2026-08-28T10:00:00', '2026-08-30T10:00:00', '2026-09-01T10:00:00'].map((d, i) => ({
      id: 'w' + i, dedupeKey: 'wk' + i, ruleId: 'bill-due-soon' as const, category: 'bills' as const,
      level: 'important' as const, title: 't', body: 'b', createdAt: new Date(d).toISOString(),
      readAt: null, deliveredOs: false, origin: 'client' as const,
    })),
  };
  const cappedWeek = run(over190('2026-09-02T12:00:00'), allOn(), spentWeek, D2);
  check('escalation still cannot beat the 3-per-week cap', cappedWeek.records.length === 0);

  // --- reminders keep the flat 48h -------------------------------------------
  const reviewSlice = (date: string) => slice({ safeSpendLimit: 40, transactions: [tx({ amount: 12, date })] });
  const rev1 = run(reviewSlice('2026-09-01T12:00:00'), allOn(), defaultLog(), D1);
  check('Daily Review reminder fires', rev1.records[0]?.ruleId === 'daily-review-due', rev1.records[0]?.ruleId);
  const rev2 = run(reviewSlice('2026-09-02T12:00:00'), allOn(), rev1.log, D2);
  check('and reminders still keep the flat 48h cooldown', rev2.records.length === 0);
}


// =============================================================================
section('10. "Off" means off, on every channel');
// Opting out of a finance app's notifications must not leave it quietly
// recording a behavioural trail. Exercises the real tick() rather than
// evaluate(), because the guarantee lives in tick()'s short-circuit: an empty
// result has to silence the inbox, the in-app banner AND the OS notification.
// =============================================================================
{
  const storeState = (userId: string, over: Partial<Slice> = {}) => ({
    userId,
    dataFresh: true,
    isConfigured: true,
    hasCompletedOnboarding: true,
    ...slice(over),
  }) as any;

  // Something genuinely worth saying: 90 spent against a 40 limit.
  const worthSaying = { safeSpendLimit: 40, transactions: [tx({ amount: 90, date: '2026-09-01T12:00:00' })] };

  // Permission is GRANTED throughout, so nothing here is silent merely because
  // the browser would have refused.
  notificationPermission = 'granted';

  // --- off ------------------------------------------------------------------
  let banners = 0;
  let unsubscribe = subscribeToEmissions(() => { banners++; });
  osDeliveries = 0;

  initForUser('u-off');
  setMode('off');
  const offResult = tick(storeState('u-off', worthSaying), EVENING);
  await new Promise(r => setTimeout(r, 20));
  unsubscribe();

  check('off: nothing is emitted', offResult.emitted.length === 0);
  check('off: the tick actually ran (not skipped as not-ready)',
    offResult.skipped === undefined, String(offResult.skipped));
  check('off: no inbox record is written', getRecords().length === 0,
    String(getRecords().length));
  check('off: no in-app banner fires', banners === 0, String(banners));
  check('off: nothing reaches the device', osDeliveries === 0, String(osDeliveries));

  // --- positive control -----------------------------------------------------
  // Without this, every assertion above could be passing for the wrong reason.
  banners = 0;
  osDeliveries = 0;
  unsubscribe = subscribeToEmissions(() => { banners++; });

  initForUser('u-on');
  setMode('all');
  const onResult = tick(storeState('u-on', worthSaying), EVENING);
  await new Promise(r => setTimeout(r, 20));
  unsubscribe();

  check('control: the same state DOES emit when notifications are on',
    onResult.emitted.length === 1, String(onResult.emitted.length));
  check('control: it is written to the inbox', getRecords().length === 1,
    String(getRecords().length));
  check('control: the in-app banner fires', banners === 1, String(banners));
  check('control: it reaches the device', osDeliveries === 1, String(osDeliveries));

  notificationPermission = 'default';
}

// ── Result ───────────────────────────────────────────────────────────────────

console.log(`\n${'-'.repeat(60)}`);
if (failures.length === 0) {
  console.log(`ALL PASS  (${passed} checks)`);
  process.exit(0);
} else {
  console.log(`${passed} passed, ${failures.length} FAILED:`);
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
}
