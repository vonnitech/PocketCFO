// Regression checks for the wishlist lens.
// Run: npx tsx src/lib/wishlist.check.ts
import { daysOfCleared, describeDays, daysSince } from './wishlist';

let failed = 0;
const expect = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
};

// ── the cost lens ───────────────────────────────────────────────────────────
expect('180 against 45 a day is 4 days', daysOfCleared(180, 45), 4);
expect('no daily figure yet means no lens', daysOfCleared(180, 0), null);
expect('a negative daily figure means no lens', daysOfCleared(180, -45), null);
expect('a free item has no lens', daysOfCleared(0, 45), null);
expect('a non-finite amount has no lens', daysOfCleared(Number.NaN, 45), null);

// ── how it is said ──────────────────────────────────────────────────────────
expect('null stays null', describeDays(null), null);
expect('a fraction of a day is not rounded up to one', describeDays(0.3), 'less than a day');
expect('just under a day reads as one', describeDays(0.9), 'about 1 day');
expect('exactly one day', describeDays(1), 'about 1 day');
expect('four days', describeDays(4), 'about 4 days');
expect('4.4 rounds down', describeDays(4.4), 'about 4 days');
expect('4.6 rounds up', describeDays(4.6), 'about 5 days');
expect('absurd values do not print 900 days', describeDays(900), 'more than a year');

// Never a bare decimal, for any input. That is the whole job of this function.
let decimalLeak = 0;
for (let i = 0; i < 5000; i++) {
  const d = Math.random() * 500;
  const out = describeDays(d);
  if (out && /\d+\.\d/.test(out)) decimalLeak++;
}
expect('5000 random durations never print a decimal', decimalLeak, 0);

// ── how long it has sat ─────────────────────────────────────────────────────
const today = new Date(2026, 9, 13); // 13 October 2026
expect('added today is 0 days', daysSince('2026-10-13', today), 0);
expect('added yesterday is 1 day', daysSince('2026-10-12', today), 1);
expect('added a fortnight ago', daysSince('2026-09-29', today), 14);
expect('a future date never goes negative', daysSince('2026-10-20', today), 0);
expect('a malformed date is treated as today', daysSince('not-a-date', today), 0);

console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
if (failed > 0) process.exit(1);
