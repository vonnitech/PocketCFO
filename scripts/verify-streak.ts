/**
 * Verification harness for the Daily review streak (src/core/streak.ts).
 *
 *   npx tsx scripts/verify-streak.ts
 *
 * Plain script, no test runner: fixed clocks, exits non-zero on any failure.
 */

import { computeStreak, payCycleOf, streakAnchorDay } from '../src/core/streak';

let failures = 0;
let passes = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passes++;
  else { failures++; console.error(`FAIL ${name}\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(actual)}`); }
};

// Local noon on a given day, so the clock is unambiguous in any timezone.
const at = (key: string) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); };
// Stored review dates are ISO timestamps; use local midday like the app would save.
const reviews = (...keys: string[]) => keys.map(k => at(k).toISOString());
const range = (from: string, n: number) => Array.from({ length: n }, (_, i) => {
  const d = at(from); d.setDate(d.getDate() + i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

// ── Pay cycles ───────────────────────────────────────────────────────────────
check('cycle: on anchor day starts a cycle', payCycleOf('2026-10-25', 25), '2026-10');
check('cycle: day before anchor is the previous cycle', payCycleOf('2026-10-24', 25), '2026-9');
check('cycle: January before anchor wraps to December', payCycleOf('2026-01-03', 25), '2025-12');
check('cycle: anchor 31 in a 30-day month uses the 30th', payCycleOf('2026-11-30', 31), '2026-11');
check('cycle: anchor 31 in February uses the 28th', payCycleOf('2026-02-28', 31), '2026-2');
check('cycle: anchor 0 falls back to the 1st', payCycleOf('2026-10-01', 0), '2026-10');
check('anchor: stored anchor wins', streakAnchorDay(25, '2026-11-03'), 25);
check('anchor: next payday day when no anchor', streakAnchorDay(0, '2026-11-03'), 3);
check('anchor: 1st when nothing is known', streakAnchorDay(0, ''), 1);

// ── Basics ───────────────────────────────────────────────────────────────────
const today = '2026-10-30';
check('empty history', computeStreak([], 25, at(today)),
  { current: 0, longest: 0, reviewedToday: false, yesterdayCovered: false, freeDayLeft: true });

check('reviewed today only', computeStreak(reviews(today), 25, at(today)).current, 1);

check('counts past 7 days (the old cap)', computeStreak(reviews(...range('2026-10-01', 30)), 1, at(today)).current, 30);

check('today still open: streak through yesterday stays alive',
  computeStreak(reviews('2026-10-27', '2026-10-28', '2026-10-29'), 25, at(today)),
  { current: 3, longest: 3, reviewedToday: false, yesterdayCovered: false, freeDayLeft: true });

check('two reviews on one day count once',
  computeStreak([at('2026-10-29').toISOString(), new Date(2026, 9, 29, 20).toISOString()], 25, at(today)).current, 1);

// ── Forgiveness ──────────────────────────────────────────────────────────────
// Cycle with anchor 25 runs Oct 25 .. Nov 24.
check('one missed day inside a cycle is covered',
  computeStreak(reviews('2026-10-26', '2026-10-27', '2026-10-29', today), 25, at(today)),
  { current: 3 + 0 + 1, longest: 4, reviewedToday: true, yesterdayCovered: false, freeDayLeft: false });

check('a second missed day in the same cycle ends the streak',
  computeStreak(reviews('2026-11-01', '2026-11-03', '2026-11-04', '2026-11-06'), 25, at('2026-11-06')).current, 1);

check('two missed days in a row end the streak',
  computeStreak(reviews('2026-10-26', '2026-10-27', '2026-10-30'), 25, at(today)).current, 1);

check('a new cycle gets a new free day',
  computeStreak(reviews('2026-10-20', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-27', '2026-10-28'), 25, at('2026-10-28')).current, 7);

check('yesterday missed, today open: covered and still alive',
  computeStreak(reviews('2026-10-26', '2026-10-27', '2026-10-28'), 25, at(today)),
  { current: 3, longest: 3, reviewedToday: false, yesterdayCovered: true, freeDayLeft: false });

check('yesterday missed but the free day is gone: streak is over',
  computeStreak(reviews('2026-10-25', '2026-10-27', '2026-10-28'), 25, at(today)).current, 0);

check('a free day used by an earlier, broken run is not given back',
  computeStreak(reviews('2026-10-25', '2026-10-27', '2026-10-29', today), 25, at(today)).current, 2);

check('missed day before the first ever review is not covered',
  computeStreak(reviews('2026-10-28'), 25, at(today)).current, 1);

// ── Longest ──────────────────────────────────────────────────────────────────
check('longest survives a break',
  computeStreak(reviews(...range('2026-09-01', 12), '2026-10-29', today), 25, at(today)),
  { current: 2, longest: 12, reviewedToday: true, yesterdayCovered: false, freeDayLeft: true });

check('longest is never below current',
  (() => { const s = computeStreak(reviews(...range('2026-10-20', 11)), 25, at(today)); return s.longest >= s.current; })(), true);

check('future-dated reviews are ignored',
  computeStreak(reviews(today, '2026-11-02'), 25, at(today)).current, 1);

check('unparseable dates are ignored',
  computeStreak(['not a date', '', ...reviews(today)], 25, at(today)).current, 1);

// ── The day before payday (the off-by-one the review caught) ────────────────
// The app saves review dates as plain day keys, so these use that format.
// Anchor 25: the Sep cycle is Sep 25 .. Oct 24, the Oct cycle Oct 25 .. Nov 24.
const keysExcept = (from: string, n: number, ...skip: string[]) => range(from, n).filter(k => !skip.includes(k));

check('plain day keys: a missed day is covered the same as with timestamps',
  computeStreak(['2026-10-26', '2026-10-27', '2026-10-29', today], 25, at(today)).current, 4);

check('two misses in one cycle, the second on the day before payday: streak ends',
  computeStreak(keysExcept('2026-10-01', 30, '2026-10-10', '2026-10-24'), 25, at(today)).current, 6);

check('one miss on the day before payday, one after payday: both covered',
  computeStreak(keysExcept('2026-10-15', 16, '2026-10-24', '2026-10-28'), 25, at(today)),
  { current: 14, longest: 14, reviewedToday: true, yesterdayCovered: false, freeDayLeft: false });

check('payday, yesterday missed, last cycle already used its free day: streak is over',
  computeStreak(keysExcept('2026-10-01', 23, '2026-10-10'), 25, at('2026-10-25')),
  { current: 0, longest: 22, reviewedToday: false, yesterdayCovered: false, freeDayLeft: true });

check('free day left on the last day of a cycle reflects that cycle',
  computeStreak(keysExcept('2026-10-01', 24, '2026-10-10'), 25, at('2026-10-24')).freeDayLeft, false);

check('free day left on the first day of a new cycle (anchor 1, Dec 31 missed)',
  computeStreak(['2026-12-30', '2027-01-01'], 1, at('2027-01-01')),
  { current: 2, longest: 2, reviewedToday: true, yesterdayCovered: false, freeDayLeft: true });

console.log(`\n${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
