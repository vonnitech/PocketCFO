// Checks the Velocity Control reshape. Run: npx tsx scripts/verify-velocity.ts
//
// The property that matters: WEEKEND_LOADED must move money between days
// without creating or destroying any. If that fails, the dashboard will show a
// deficit the engine never actually had.

import {
  calculatePacedAllowance,
  countRemainingDayTypes,
  normalizeVelocityConfig,
  pacedWindowTotal,
  type VelocityConfig,
} from '../src/core/velocity';
import { calculateFlatSafeSpend, calculateTrueSafeSpend } from '../src/core/math';

let failures = 0;
const check = (name: string, pass: boolean, detail = '') => {
  if (!pass) failures++;
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

const cfg = (over: Partial<VelocityConfig> = {}): VelocityConfig => ({
  paceModel: 'WEEKEND_LOADED',
  weekdayTrim: 10,
  surplusRouting: 'ROLL_TOMORROW',
  sweepTargetVaultId: null,
  ...over,
});

// ── 1. Budget neutrality across a wide sweep ────────────────────────────────
{
  let worst = 0;
  let cases = 0;
  for (let startOffset = 0; startOffset < 28; startOffset++) {
    for (const days of [1, 2, 3, 5, 7, 9, 14, 21, 30]) {
      for (const flat of [12.5, 40, 137.77, 500]) {
        for (const trim of [1, 5, 10, 33.33]) {
          const today = new Date(2026, 8, 1 + startOffset); // Sep 2026
          const paced = calculatePacedAllowance(flat, days, cfg({ weekdayTrim: trim }), today);
          const drift = Math.abs(pacedWindowTotal(paced) - flat * days);
          worst = Math.max(worst, drift);
          cases++;
        }
      }
    }
  }
  check(
    `budget neutral over ${cases} combinations`,
    worst < 1e-9,
    `worst drift ${worst.toExponential(2)}`,
  );
}

// ── 2. The Thursday switch, the case actually asked about ───────────────────
{
  // Thu 3 Sep 2026 through payday on Mon 7 Sep: Thu, Fri, Sat, Sun, Mon = 5 days.
  const thursday = new Date(2026, 8, 3);
  check('3 Sep 2026 is a Thursday', thursday.getDay() === 4);

  const counts = countRemainingDayTypes(thursday, 5);
  check(
    'window sees 3 weekdays (Thu, Fri, Mon) and 2 weekend days',
    counts.weekdays === 3 && counts.weekend === 2,
    `got ${counts.weekdays}/${counts.weekend}`,
  );

  const flat = 100;
  const paced = calculatePacedAllowance(flat, 5, cfg({ weekdayTrim: 20 }), thursday);

  check('weekday rate is flat minus trim', paced.weekdayRate === 80, `${paced.weekdayRate}`);
  // 3 weekdays x 20 trimmed = 60, spread over 2 weekend days = +30 each.
  check('weekend rate is flat plus redistributed trim', paced.weekendRate === 130, `${paced.weekendRate}`);
  check('today (Thu) uses the weekday rate', paced.todayRate === 80);
  check('window total unchanged', Math.abs(pacedWindowTotal(paced) - 500) < 1e-9);

  // The failure mode being avoided: a calendar-week model would have counted
  // Mon-Fri as five trimmable weekdays and funded the weekend with 5 x 20 = 100,
  // i.e. 50 per weekend day, despite Mon-Wed having already been spent flat.
  check('does not claim trim for days already past', paced.weekendRate !== 150);
}

// ── 3. Edge cases ───────────────────────────────────────────────────────────
{
  // Saturday 5 Sep 2026, two days to payday: Sat + Sun, no weekdays left.
  const saturday = new Date(2026, 8, 5);
  check('5 Sep 2026 is a Saturday', saturday.getDay() === 6);
  const noWeekdays = calculatePacedAllowance(100, 2, cfg(), saturday);
  check('no weekdays left falls back to flat', noWeekdays.weekdayRate === 100 && noWeekdays.weekendRate === 100);
  check('and says why', noWeekdays.note !== null, noWeekdays.note ?? '');

  // Mon 7 Sep to Fri 11 Sep: no weekend in range.
  const monday = new Date(2026, 8, 7);
  check('7 Sep 2026 is a Monday', monday.getDay() === 1);
  const noWeekend = calculatePacedAllowance(100, 5, cfg(), monday);
  check('no weekend left falls back to flat', noWeekend.weekdayRate === 100 && noWeekend.weekendRate === 100);

  const overTrim = calculatePacedAllowance(50, 7, cfg({ weekdayTrim: 999 }), new Date(2026, 8, 7));
  check('trim cannot drive a weekday negative', overTrim.weekdayRate >= 0, `${overTrim.weekdayRate}`);
  check('over-trim still budget neutral', Math.abs(pacedWindowTotal(overTrim) - 350) < 1e-9);

  const zero = calculatePacedAllowance(0, 7, cfg(), new Date(2026, 8, 7));
  check('zero allowance stays zero', zero.todayRate === 0 && zero.weekendRate === 0);

  const flatModel = calculatePacedAllowance(100, 7, cfg({ paceModel: 'FLAT' }), new Date(2026, 8, 7));
  check('FLAT ignores the trim', flatModel.weekdayRate === 100 && flatModel.weekendRate === 100);

  // A profile carrying the retired AGGRESSIVE_SAVER must degrade to FLAT, not
  // throw and not silently keep trimming.
  const legacy = normalizeVelocityConfig({
    paceModel: 'AGGRESSIVE_SAVER',
    weekdayTrim: 15,
    surplusRouting: 'ROLL_TOMORROW',
    sweepTargetVaultId: null,
  });
  check('retired AGGRESSIVE_SAVER normalises to FLAT', legacy.paceModel === 'FLAT', legacy.paceModel);
  const legacyPaced = calculatePacedAllowance(100, 7, legacy, new Date(2026, 8, 7));
  check('and therefore does not reshape', legacyPaced.weekdayRate === 100 && legacyPaced.weekendRate === 100);
  check('nor reduce the window total', Math.abs(pacedWindowTotal(legacyPaced) - 700) < 1e-9);
}

// ── 4. Integration: the engine must actually be wired in ────────────────────
//
// Every unit check above passed for a whole session while calculateTrueSafeSpend
// ignored velocityConfig completely, so the dashboard kept showing the unshaped
// number after saving a pace model. Pure-function tests cannot catch a
// disconnected engine. This can.
{
  // A weekday far enough out that the window always holds both day types.
  const payday = new Date();
  payday.setDate(payday.getDate() + 21);
  const nextPayday = payday.toISOString().slice(0, 10);

  const base = {
    nextPayday,
    liquidAssets: 100000,
    upcomingBills: 0,
    monthlyTakeHome: 0,
    fixedBills: 0,
    monthlySavingsGoal: 0,
    hardDailyCap: 0,
  };

  const flatState = { ...base, velocityConfig: cfg({ paceModel: 'FLAT', weekdayTrim: 0 }) } as never;
  const flat = calculateFlatSafeSpend(flatState);
  check('flat baseline is positive', flat > 0, flat.toFixed(2));
  check('FLAT config leaves the allowance unshaped', calculateTrueSafeSpend(flatState) === flat);

  const trim = Math.floor(flat * 0.25);
  const pacedConfig = cfg({ weekdayTrim: trim });
  const pacedState = { ...base, velocityConfig: pacedConfig } as never;

  const today = calculateTrueSafeSpend(pacedState);
  const expected = calculatePacedAllowance(flat, 21, pacedConfig).todayRate;

  check(
    'calculateTrueSafeSpend applies the pacing',
    Math.abs(today - expected) < 0.01,
    `got ${today.toFixed(2)}, expected ${expected.toFixed(2)}`,
  );
  check(
    'the shaped number differs from the flat one',
    Math.abs(today - flat) > 0.01,
    `today ${today.toFixed(2)} vs flat ${flat.toFixed(2)}`,
  );
}

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
