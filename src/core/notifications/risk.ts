// =========================================================================
// Overspend risk model and escalation.
//
// The 48h same-nudge cooldown is right for reminders (Daily Review, bills,
// payday) because repeating them adds nothing. It is wrong for overspend
// warnings, because the situation they describe can get materially worse inside
// the cooldown, and the app's core promise is preventing a blown pay cycle.
//
// So overspend warnings are not time-throttled, they are SEVERITY-throttled:
// the same severity is said once and then held, and only a genuine worsening
// earns another one. The global caps (1/day, 3/week, quiet hours) still apply
// on top and are never bypassed, so the worst case is still three warnings in a
// week for someone actively going under.
//
// Pure and clock-injected, same as the rest of the module, so it runs unchanged
// server-side when closed-app push lands.
// =========================================================================

import { calculateDailyDrain, calculateDaysUntilPayday, toLocalDateKey } from '../math';
import type { NotificationStateSlice } from './rules';
import type { Transaction } from '../../store/useStore';

// ── Levels ───────────────────────────────────────────────────────────────────
//
// FOUR levels, ordered by seriousness. Worst wins when several are true at once.
//
//   3  SHORTFALL  Committed bills exceed the cash available before payday
//   2  CRITICAL   Daily number below 25% of a baseline day, including exactly 0
//   1  OVER       Spent past today's number
//   0  NONE       Nothing wrong
//
// NONE is a real level, not padding. It is written to memory on recovery, and
// comparing against it is the only way to tell "still over, same as when we told
// you" from "recovered, then went over again". Drop it and relapse detection
// silently stops working. Any summary of this model lists all four.
//
// INTERNAL ONLY. These levels are a memory and escalation mechanism, not a
// vocabulary for the product. Nothing in src/components or src/pages imports
// them, and no copy names a level: the user reads about "risk alerts" and reads
// the actual numbers, never a tier. Keep it that way. Exposing NONE in
// particular would be exposing an implementation detail as if it were a state
// the user is in.

export const RISK = {
  // Nothing to say.
  NONE: 0,
  // Spent more than today's number. Recoverable out of the days ahead.
  OVER: 1,
  // The daily number itself is critically thin, including exactly zero.
  CRITICAL: 2,
  // Committed bills exceed the cash available before payday. This is the real
  // "safe spend below zero": calculateRawSafeSpend clamps at 0, so a £0 number
  // caused by a £400 shortfall is indistinguishable from a £0 number caused by
  // breaking even. The clamp is right for the dashboard and wrong for a warning.
  SHORTFALL: 3,
} as const;

export type RiskLevel = typeof RISK[keyof typeof RISK];

// At or above this level, a new day re-arms the warning even with no change in
// severity. Below it, a persisting situation is left alone.
export const HIGH_RISK_LEVEL: RiskLevel = RISK.CRITICAL;

// A daily number below this fraction of a level month counts as critical.
const CRITICAL_FRACTION = 0.25;

// A thin number the day before payday is the system working, not a problem.
const CRITICAL_MIN_DAYS_TO_PAYDAY = 2;

// ── Severity steps ───────────────────────────────────────────────────────────
//
// Severity is measured in "risk units": how many days of normal spending the
// user is under water by. Scale-free, so it means the same thing on a £900
// income as on a £9000 one.
//
// The ladder roughly doubles at each rung, so advancing a step takes a real
// worsening rather than a rounding difference. This is what "the negative
// amount worsens meaningfully" is enforced by.
const STEP_LADDER = [0.25, 0.5, 1, 2, 4, 8] as const;

export const severityStep = (riskUnits: number): number =>
  STEP_LADDER.filter(threshold => riskUnits >= threshold).length;

// ── Assessment ───────────────────────────────────────────────────────────────

export interface RiskAssessment {
  level: RiskLevel;
  step: number;
  // Today's remaining allowance. Negative means the day is already over budget.
  headroom: number;
  // How far past today's number, as a positive number (0 when not over).
  overshoot: number;
  // Committed bills minus available cash (0 when covered).
  shortfall: number;
  // One day of spending at a level month, used to make severity scale-free.
  baselineDaily: number;
  riskUnits: number;
  overspentToday: boolean;
  daysToPayday: number;
}

export function assessRisk(state: NotificationStateSlice, now: Date): RiskAssessment {
  const todayKey = toLocalDateKey(now);
  const todaysTx: Transaction[] = state.transactions.filter(
    tx => toLocalDateKey(tx.date) === todayKey,
  );
  const drain = calculateDailyDrain(todaysTx);

  const headroom = state.safeSpendLimit - drain;
  const overshoot = Math.max(0, -headroom);
  const overspentToday = state.safeSpendLimit > 0 && drain > state.safeSpendLimit;

  const shortfall = Math.max(0, (state.upcomingBills || 0) - state.liquidAssets);

  // Falls back to the daily number when no take-home is configured, so severity
  // still has a meaningful denominator rather than dividing by zero.
  const baselineDaily =
    state.monthlyTakeHome > 0 ? state.monthlyTakeHome / 30
    : state.safeSpendLimit > 0 ? state.safeSpendLimit
    : 0;

  const daysToPayday = state.nextPayday ? calculateDaysUntilPayday(state.nextPayday) : 0;

  // Asked against the UNSHAPED figure. Velocity moves money between days
  // without changing how much there is, so a deliberately thin Tuesday funding
  // a fat Saturday is not a thin position. Reading the paced number here turned
  // a pacing preference into a daily risk alert about a problem the user had
  // chosen and already knew about.
  const capacityDaily = state.flatSafeSpendLimit > 0
    ? state.flatSafeSpendLimit
    : state.safeSpendLimit;

  const criticallyLow =
    baselineDaily > 0 &&
    capacityDaily < baselineDaily * CRITICAL_FRACTION &&
    daysToPayday >= CRITICAL_MIN_DAYS_TO_PAYDAY;

  // Worst wins. A shortfall outranks a thin number, which outranks a single
  // over-budget day, because that is the order in which they are hard to undo.
  const level: RiskLevel =
    shortfall > 0 ? RISK.SHORTFALL
    : criticallyLow ? RISK.CRITICAL
    : overspentToday ? RISK.OVER
    : RISK.NONE;

  // Both lenses describe the same hole, so the worse one is the severity rather
  // than their sum, which would double-count.
  const riskUnits = baselineDaily > 0
    ? Math.max(overshoot, shortfall) / baselineDaily
    : 0;

  return {
    level,
    step: level === RISK.NONE ? 0 : Math.max(1, severityStep(riskUnits)),
    headroom,
    overshoot,
    shortfall,
    baselineDaily,
    riskUnits,
    overspentToday,
    daysToPayday,
  };
}

// ── Escalation ───────────────────────────────────────────────────────────────

// What the user was last actually TOLD, not what was last true. Written only on
// emit (plus a silent write on recovery, see `recoveryMemory`), so a warning
// suppressed by the budget does not count as having been said.
export interface RiskMemory {
  level: number;
  step: number;
  day: string;
  overshoot: number;
  // The identity the last warning actually went out under. A held repeat is
  // emitted under this same key so it inherits that key's live 48h cooldown.
  // Without it, the first warning would go out under an escalated key, leaving
  // a separate "hold" key with no cooldown, and an unchanged situation would
  // warn a second time before settling.
  lastKey: string;
}

const memKey = (ruleId: string, field: keyof RiskMemory) => `risk:${ruleId}:${field}`;

export function readRiskMemory(
  ruleId: string,
  memory: Record<string, string | number>,
): RiskMemory | null {
  const level = Number(memory[memKey(ruleId, 'level')]);
  if (!Number.isFinite(level)) return null;
  return {
    level,
    step: Number(memory[memKey(ruleId, 'step')]) || 0,
    day: String(memory[memKey(ruleId, 'day')] ?? ''),
    overshoot: Number(memory[memKey(ruleId, 'overshoot')]) || 0,
    lastKey: String(memory[memKey(ruleId, 'lastKey')] ?? ''),
  };
}

export function writeRiskMemory(
  ruleId: string,
  m: RiskMemory,
): Record<string, string | number> {
  return {
    [memKey(ruleId, 'level')]: m.level,
    [memKey(ruleId, 'step')]: m.step,
    [memKey(ruleId, 'day')]: m.day,
    [memKey(ruleId, 'overshoot')]: m.overshoot,
    [memKey(ruleId, 'lastKey')]: m.lastKey,
  };
}

// Recording a return to safety. Without this the system cannot tell "still over,
// same as when we told you" from "recovered, then went over again", and the
// second of those is a new event the user should hear about.
export const recoveryMemory = (ruleId: string, todayKey: string) =>
  writeRiskMemory(ruleId, { level: RISK.NONE, step: 0, day: todayKey, overshoot: 0, lastKey: '' });

export interface EscalationDecision {
  // The dedupe identity to emit under. A fresh identity sidesteps the 48h
  // cooldown on the previous one; the shared "hold" identity keeps it.
  dedupeKey: string;
  escalated: boolean;
  // Why, for copy and for tests.
  reason: 'first' | 'level-up' | 'step-up' | 'relapse' | 'new-day-high-risk' | 'hold';
}

export function decideEscalation(
  ruleId: string,
  assessment: RiskAssessment,
  todayKey: string,
  memory: Record<string, string | number>,
): EscalationDecision {
  const last = readRiskMemory(ruleId, memory);

  const reason: EscalationDecision['reason'] =
    // Never warned about this before.
    !last ? 'first'
    // They had recovered to safety and have gone back under. A new episode.
    : last.level === RISK.NONE ? 'relapse'
    // Crossed into a worse kind of trouble, e.g. over-budget to cannot-cover-bills.
    : assessment.level > last.level ? 'level-up'
    // Same kind of trouble, but meaningfully deeper.
    : assessment.step > last.step ? 'step-up'
    // Still seriously exposed on a new day.
    : assessment.level >= HIGH_RISK_LEVEL && todayKey !== last.day ? 'new-day-high-risk'
    : 'hold';

  const escalated = reason !== 'hold';

  return {
    escalated,
    reason,
    // The escalated identity carries the level, step and day, so each genuine
    // worsening is a distinct nudge that the cooldown has never seen.
    //
    // A held repeat reuses the identity the last warning went out under, so it
    // inherits that key's running 48h cooldown. The situation being unchanged is
    // therefore throttled exactly as any ordinary reminder would be, and only
    // once that cooldown expires does an unchanged-but-still-bad state warn again.
    dedupeKey: escalated
      ? `${ruleId}:${assessment.level}:${assessment.step}:${todayKey}`
      : (last?.lastKey || `${ruleId}:hold`),
  };
}
