// Velocity Control: reshapes the daily allowance across the days left in the
// pay cycle without changing how much there is to spend.
//
// WHY THIS IS NOT A WEEKLY REDISTRIBUTION
//
// The brief asked to trim Mon-Fri, aggregate the week's trim, and hand it to
// Sat-Sun. That double-counts against this engine.
//
// calculateRawSafeSpend does not hold a fixed weekly budget. It recomputes from
// current liquidAssets and days-until-payday every single time it runs. So
// money you did not spend on Monday is already back in liquidAssets on Tuesday,
// and Tuesday's flat rate is already higher because of it. The rollover is
// automatic. Aggregating Monday's trim and adding it to Saturday on top would
// credit that same money twice: once through the higher recomputed flat rate,
// and again as the accumulated trim.
//
// So this works the other way round. Each day it takes the CURRENT flat rate,
// looks only at the days still ahead, and splits that same money into a lower
// weekday number and a higher weekend one. Nothing is banked, nothing carries,
// and the total across the remaining window is identical to the flat total.
//
// THE THURSDAY CASE
//
// Because the window is always "from today to payday", switching to
// WEEKEND_LOADED on a Thursday needs no special handling. Monday to Wednesday
// are simply not in the window, so no trim is claimed for days that already
// happened at the flat rate. Thursday and Friday are the only weekdays left to
// trim, and the weekend is funded by exactly that much and no more. A
// calendar-week model would have over-funded the weekend by three days of trim
// that were never actually withheld from anything.

// Velocity controls WHEN money burns, never how much. Overall burn-rate
// reduction stays with SPEND_TIERS and hardDailyCap; a third mechanism
// throttling the same number was bloat, so AGGRESSIVE_SAVER is gone.
export type PaceModel = 'FLAT' | 'WEEKEND_LOADED';
export type SurplusRouting = 'ROLL_WEEKEND' | 'SWEEP_VAULT' | 'ROLL_TOMORROW';

export interface VelocityConfig {
  paceModel: PaceModel;
  /** Currency amount shaved off each remaining weekday. */
  weekdayTrim: number;
  surplusRouting: SurplusRouting;
  /** SINKING_FUND vault id. Only meaningful when surplusRouting is SWEEP_VAULT. */
  sweepTargetVaultId: string | null;
}

export const DEFAULT_VELOCITY_CONFIG: VelocityConfig = {
  paceModel: 'FLAT',
  weekdayTrim: 0,
  surplusRouting: 'ROLL_TOMORROW',
  sweepTargetVaultId: null,
};

export const PACE_MODELS: { id: PaceModel; label: string; blurb: string }[] = [
  { id: 'FLAT',           label: 'Flat',           blurb: 'Same number every day' },
  { id: 'WEEKEND_LOADED', label: 'Weekend Loaded', blurb: 'Trim weekdays, spend it Sat and Sun' },
];

export const SURPLUS_ROUTES: { id: SurplusRouting; label: string; blurb: string }[] = [
  { id: 'ROLL_TOMORROW', label: 'Roll to Tomorrow', blurb: 'Leftovers lift tomorrow' },
  { id: 'ROLL_WEEKEND',  label: 'Roll to Weekend',  blurb: 'Leftovers stack onto Sat and Sun' },
  { id: 'SWEEP_VAULT',   label: 'Sweep to Vault',   blurb: 'Leftovers move into a sinking fund' },
];

export interface PacedAllowance {
  /** The unshaped flat average. Always the honest total/days figure. */
  currentDailyBaseline: number;
  weekdayRate: number;
  weekendRate: number;
  /** Whichever of the two applies to the date passed in. */
  todayRate: number;
  weekdaysRemaining: number;
  weekendDaysRemaining: number;
  /** Trim after clamping. Differs from config.weekdayTrim when it was too large. */
  appliedTrim: number;
  /** Set when a requested trim could not be applied in full, with the reason. */
  note: string | null;
}

// AGGRESSIVE_SAVER is intentionally absent: a profile still carrying it from
// before normalises to FLAT rather than erroring.
const PACE_IDS = new Set<string>(['FLAT', 'WEEKEND_LOADED']);
const ROUTE_IDS = new Set<string>(['ROLL_WEEKEND', 'SWEEP_VAULT', 'ROLL_TOMORROW']);

/**
 * Coerces whatever came back from the jsonb column into a usable config. Rows
 * written before the migration return null, and a hand-edited or older-client
 * row can carry anything, so every field is validated rather than trusted. An
 * unrecognised paceModel falls back to FLAT, which is the no-op.
 */
export const normalizeVelocityConfig = (raw: unknown): VelocityConfig => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_VELOCITY_CONFIG };
  const r = raw as Record<string, unknown>;

  const paceModel = typeof r.paceModel === 'string' && PACE_IDS.has(r.paceModel)
    ? (r.paceModel as PaceModel)
    : DEFAULT_VELOCITY_CONFIG.paceModel;

  const surplusRouting = typeof r.surplusRouting === 'string' && ROUTE_IDS.has(r.surplusRouting)
    ? (r.surplusRouting as SurplusRouting)
    : DEFAULT_VELOCITY_CONFIG.surplusRouting;

  const trimRaw = Number(r.weekdayTrim);
  const weekdayTrim = Number.isFinite(trimRaw) && trimRaw > 0 ? trimRaw : 0;

  // Only meaningful for SWEEP_VAULT. Held either way so switching routes and
  // back does not lose the chosen vault.
  const sweepTargetVaultId = typeof r.sweepTargetVaultId === 'string' && r.sweepTargetVaultId
    ? r.sweepTargetVaultId
    : null;

  return { paceModel, weekdayTrim, surplusRouting, sweepTargetVaultId };
};

export const isWeekendDay = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

/**
 * Splits a forward-looking window into weekday and weekend counts, starting
 * with `from` itself. Counting from today is what keeps the Thursday case
 * correct: days already gone are never in the window.
 */
export const countRemainingDayTypes = (
  from: Date,
  days: number,
): { weekdays: number; weekend: number } => {
  let weekdays = 0;
  let weekend = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    if (isWeekendDay(d)) weekend++;
    else weekdays++;
  }
  return { weekdays, weekend };
};

/**
 * Reshapes `flat` across the remaining window. Pure: takes the already-computed
 * flat rate rather than AppState, so it runs outside the browser and cannot
 * accidentally re-derive the budget on a different basis than the engine did.
 */
export const calculatePacedAllowance = (
  flat: number,
  daysRemaining: number,
  config: VelocityConfig,
  today: Date = new Date(),
): PacedAllowance => {
  const safeFlat = Number.isFinite(flat) && flat > 0 ? flat : 0;
  const days = Number.isFinite(daysRemaining) && daysRemaining > 0 ? Math.floor(daysRemaining) : 0;
  const { weekdays, weekend } = countRemainingDayTypes(today, days);

  const flatResult: PacedAllowance = {
    currentDailyBaseline: safeFlat,
    weekdayRate: safeFlat,
    weekendRate: safeFlat,
    todayRate: safeFlat,
    weekdaysRemaining: weekdays,
    weekendDaysRemaining: weekend,
    appliedTrim: 0,
    note: null,
  };

  if (safeFlat <= 0 || days <= 0) return flatResult;

  const requested = Number.isFinite(config.weekdayTrim) && config.weekdayTrim > 0
    ? config.weekdayTrim
    : 0;

  if (config.paceModel === 'FLAT' || requested <= 0) return flatResult;

  // A trim can never drive a day below zero.
  const appliedTrim = Math.min(requested, safeFlat);
  const clampNote = appliedTrim < requested
    ? 'Trim capped at the daily allowance'
    : null;

  // WEEKEND_LOADED. Needs both kinds of day left, or there is nowhere to move
  // money from or to.
  if (weekdays === 0 || weekend === 0) {
    return {
      ...flatResult,
      note: weekend === 0
        ? 'No weekend left before payday, running flat'
        : 'No weekdays left before payday, running flat',
    };
  }

  const weekdayRate = safeFlat - appliedTrim;
  const weekendRate = safeFlat + (appliedTrim * weekdays) / weekend;

  return {
    currentDailyBaseline: safeFlat,
    weekdayRate,
    weekendRate,
    todayRate: isWeekendDay(today) ? weekendRate : weekdayRate,
    weekdaysRemaining: weekdays,
    weekendDaysRemaining: weekend,
    appliedTrim,
    note: clampNote,
  };
};

/**
 * Total across the remaining window. Used to assert the reshape moved money
 * around without inventing or destroying any.
 */
export const pacedWindowTotal = (paced: PacedAllowance): number =>
  paced.weekdayRate * paced.weekdaysRemaining + paced.weekendRate * paced.weekendDaysRemaining;
