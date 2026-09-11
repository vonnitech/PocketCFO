import type { AppState, Transaction } from '../store/useStore';
import { calculatePacedAllowance, DEFAULT_VELOCITY_CONFIG } from './velocity';
import { SplitBreakdown } from '../types/split';

const formatLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseStoredDate = (value: string): Date => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
};

// Identity of a bill for paid-this-cycle bookkeeping. Lives here rather than in
// the store because it is pure and because `core/notifications/rules.ts` needs
// it without dragging the whole Zustand store (and Supabase) into a module that
// is meant to stay runnable outside the browser. Re-exported from the store so
// existing call sites are unchanged.
export const billKey = (b: { name: string; amount: number }): string =>
  `${b.name.trim().toLowerCase()}:${(b.amount || 0).toFixed(2)}`;

export const toLocalDateKey = (value: Date | string): string => {
  const date = typeof value === 'string' ? parseStoredDate(value) : value;
  return Number.isNaN(date.getTime()) ? '' : formatLocalDateKey(date);
};

/**
 * 1. The Core Engine (Horizon Math — Pay-Cycle Liquidity)
 */
export const calculateTotalMonthlyDiscretionary = (state: AppState): number => {
  return state.monthlyTakeHome - state.fixedBills - state.monthlySavingsGoal;
};

export const calculateRemainingDaysInMonth = (): number => {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate() + 1;
};

// Excluded from "daily drain" — these are not discretionary spend.
// Bills, debt minimums and vault transfers are pre-reserved and tracked separately.
// Categories that move money INTO spendable cash. A vault withdrawal is not
// income (it is the user's own money coming back), but it does raise the cash
// balance, so every cash-flow view has to sign it the same way as income.
// Ledger already special-cased this pair inline; the dashboard activity feed
// tested for 'INCOME' alone and so rendered withdrawals as if cash had left.
// Shared here so a fourth surface cannot quietly disagree with the other three.
export const CASH_INFLOW_CATEGORIES = new Set(['INCOME', 'VAULT_WITHDRAWAL']);

export const isCashInflow = (category: string | undefined | null): boolean =>
  !!category && CASH_INFLOW_CATEGORIES.has(category);

const DISCRETIONARY_CATEGORIES = new Set(['SAVINGS', 'VAULT_DEPOSIT', 'DEBT_PAYMENT', 'BILL_PAYMENT', 'SUBSCRIPTION_PAYMENT', 'INCOME', 'VAULT_TRANSFER', 'VAULT_WITHDRAWAL']);

export const calculateDaysUntilPayday = (nextPayday: string): number => {
  if (!nextPayday) return 1;
  const [year, month, day] = nextPayday.split('-').map(Number);
  const payday = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = payday.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
};

export const calculateCurrentMonthDeposits = (transactions: Transaction[], nextPayday?: string): number => {
  let periodStart: Date;
  if (nextPayday) {
    // Period started 1 month before the next payday
    const [year, month, day] = nextPayday.split('-').map(Number);
    // month is 1-based; new Date(year, month-2, day) = same day, previous month
    periodStart = new Date(year, month - 2, day);
  } else {
    periodStart = new Date();
    periodStart.setDate(1);
  }
  periodStart.setHours(0, 0, 0, 0);
  return transactions
    .filter(tx => tx.category === 'VAULT_DEPOSIT' && new Date(tx.date) >= periodStart)
    .reduce((sum, tx) => sum + tx.amount, 0);
};

// Length of the current pay cycle in days, inferred from the next payday
// (one calendar month back → next payday). Falls back to 30 if unparseable.
export const calculatePayCycleLength = (nextPayday: string): number => {
  if (!nextPayday) return 30;
  const [y, m, d] = nextPayday.split('-').map(Number);
  if (!y || !m || !d) return 30;
  const next = new Date(y, m - 1, d);
  const prev = new Date(y, m - 2, d); // same day, previous month
  const days = Math.round((next.getTime() - prev.getTime()) / 86_400_000);
  return days > 0 ? days : 30;
};

export const calculateRawSafeSpend = (state: AppState): number => {
  if (!state.nextPayday) return 0;
  const days = calculateDaysUntilPayday(state.nextPayday);

  // Bills due before payday are always reserved out of current cash. Reserving them
  // only when the balance could cover them (the previous rule) created a cliff: at
  // a 1000 balance, 999 of bills allowed 0.05/day while 1001 of bills allowed the
  // full 1000/days, so being deeper in the hole raised the allowance. When bills
  // cannot be covered the honest answer is 0, not the whole balance.
  const upcoming = state.upcomingBills || 0;
  // Cash safety: never green-light spending more than the current balance can sustain
  // until payday (after reserving any unpaid bills).
  const dailyFromCash = Math.max(0, state.liquidAssets - upcoming) / days;

  // Income-based budget: savings is funded from your monthly take-home, not frozen
  // in your pre-payday balance. So the sustainable daily allowance is what's left of
  // your income after bills and your savings promise, spread across the pay cycle.
  // This honors the savings goal fully (it's subtracted) without zeroing out a balance
  // that the next paycheck will replenish.
  const takeHome = state.monthlyTakeHome || 0;
  if (takeHome > 0) {
    const cycleDays = calculatePayCycleLength(state.nextPayday);
    const monthlyDiscretionary = Math.max(0, takeHome - (state.fixedBills || 0) - (state.monthlySavingsGoal || 0));
    const dailyFromBudget = monthlyDiscretionary / cycleDays;
    return Math.max(0, Math.min(dailyFromBudget, dailyFromCash));
  }

  // No take-home configured → fall back to pure cash horizon (bills reserved only).
  return Math.max(0, dailyFromCash);
};

/**
 * The unshaped daily figure: the cash/budget horizon, then the hard cap.
 *
 * Anything that needs the BASELINE rather than today's shaped number must read
 * this. The Velocity screen in particular: feeding it the paced result would
 * apply the trim to an already-trimmed figure.
 */
export const calculateFlatSafeSpend = (state: AppState): number => {
  const raw = calculateRawSafeSpend(state);
  const cap = state.hardDailyCap ?? 0;
  return cap > 0 ? Math.min(raw, cap) : raw;
};

/**
 * Today's allowance, after Velocity reshapes the flat figure across the days
 * left in the cycle.
 *
 * The pacing is applied here rather than at each display site so that the
 * dashboard hero, the daily review, the notification thresholds and the exports
 * all read one number. Wiring it per-screen was the original mistake: the
 * Velocity page previewed a weekday rate the rest of the app never used.
 */
/**
 * PARKED. Nothing calls this. Do not wire it up without reading the flaw below.
 *
 * It was written for the dashboard, shipped, and pulled the same day because
 * the number it produces is not the number its name promises.
 *
 * THE FLAW: this assumes the cycle STARTED at dailyFromBudget, which is only
 * true if cash was non-binding on day one. It often is not. Start a cycle with
 * a low balance, right after rent, and dailyFromCash is already the lower of
 * the two before a penny is overspent. The function then reports a large
 * slip that never happened. On a real account it read ,870 below start
 * against a daily number of ,150.
 *
 * What it actually measures: how far cash sits below the income plan. That is a
 * real quantity, just not erosion, and the name and any UI copy would have to
 * say so.
 *
 * TO DO IT PROPERLY you need the daily number as it stood on day one of the
 * cycle. It is not recorded anywhere: ReconEntry keeps rawSpend, surplus and
 * the tier fields but never the allowance, and the resultingRunway field in
 * db/index.ts is written only by the Bill Splitter and never read back. So it
 * needs a stored baseline, one number per pay cycle, plus a column and a
 * migration.
 *
 * WHY IT WAS PARKED RATHER THAN DELETED: the gap is real. Spreading an overage
 * across the remaining days makes each day's hit invisible, so someone going
 * over daily watches the number erode with nothing naming the pattern. The
 * per-day alert only ever judges today. Worth building when the storage is
 * worth adding.
 *
 * Original description follows.
 *
 * How far today's allowance has slipped below where the cycle started.
 *
 * Needs no stored history. calculateRawSafeSpend takes the lower of two figures:
 *
 *   dailyFromBudget  income minus bills and savings, over the cycle. Fixed for
 *                    the whole cycle, so it is the number you started with.
 *   dailyFromCash    what the balance can actually sustain. Falls every time you
 *                    spend more than a day's worth.
 *
 * On day one cash is ample, so the budget figure wins and IS the starting
 * number. Spend ahead of it and cash becomes the binding constraint. The gap
 * between them is therefore exactly the erosion, no snapshots required.
 *
 * This exists because spreading an overage across the remaining days makes each
 * day's hit tiny and invisible: go over daily and the number quietly shrinks
 * with nothing ever naming the pattern. The per-day alert only ever judges
 * today.
 *
 * Returns 0 when there is no take-home configured, because without it there is
 * no plan to have drifted from.
 */
export const calculateAllowanceDrift = (state: AppState): number => {
  if (!state.nextPayday) return 0;
  const takeHome = state.monthlyTakeHome || 0;
  if (takeHome <= 0) return 0;

  const days = calculateDaysUntilPayday(state.nextPayday);
  if (days <= 0) return 0;

  const upcoming = state.upcomingBills || 0;
  const dailyFromCash = Math.max(0, state.liquidAssets - upcoming) / days;

  const cycleDays = calculatePayCycleLength(state.nextPayday);
  const monthlyDiscretionary = Math.max(0, takeHome - (state.fixedBills || 0) - (state.monthlySavingsGoal || 0));
  const dailyFromBudget = monthlyDiscretionary / cycleDays;

  // Deliberately ignores hardDailyCap and the tier multiplier: a number lowered
  // on purpose is not drift.
  return Math.max(0, dailyFromBudget - dailyFromCash);
};

/**
 * The flat figure after the chosen spend tier, before Velocity reshapes it.
 *
 * The tier is a self-imposed ceiling (90/75/50/25%), so it belongs between
 * capacity and pacing: capacity is what you could spend, the tier is what you
 * decided to allow, and pacing decides how that lands across the days.
 *
 * Exposed separately because the screens that let you change the tier have to
 * show its effect without reading a number the tier has already been applied to.
 */
export const calculateTieredSafeSpend = (state: AppState): number => {
  const flat = calculateFlatSafeSpend(state);
  const tierId = state.tierLock?.tierId;
  const tier = SPEND_TIERS.find(t => t.id === tierId);
  return tier ? flat * tier.multiplier : flat;
};

/**
 * Today's number, everything applied: capacity, then the tier, then pacing.
 *
 * The tier used to be applied only by the screens that displayed it, so picking
 * 75% changed Daily Review and Velocity while the dashboard hero carried on
 * showing the untiered figure. The number the app tells you to obey ignored the
 * limit you had chosen, and the two screens disagreed by exactly the multiplier.
 */
export const calculateTrueSafeSpend = (state: AppState): number => {
  const tiered = calculateTieredSafeSpend(state);
  if (!state.nextPayday) return tiered;
  return calculatePacedAllowance(
    tiered,
    calculateDaysUntilPayday(state.nextPayday),
    state.velocityConfig ?? DEFAULT_VELOCITY_CONFIG,
  ).todayRate;
};

/**
 * 2. The Taxes & Penalties
 */
export const UNIVERSAL_FLIP_RATE = 0.20;

export const calculateUniversalFlip = (amount: number): number => {
  return amount * UNIVERSAL_FLIP_RATE;
};

export const calculateTotalStandardDeduction = (amount: number): number => {
  return amount + calculateUniversalFlip(amount);
};

export const calculateImpulsePenalty = (amount: number, penaltyRate: number): number => {
  return amount * penaltyRate;
};

export const calculateImpulseDeduction = (amount: number, penaltyRate: number): number => {
  return amount + calculateImpulsePenalty(amount, penaltyRate);
};

/**
 * 3. The Spend Challenge
 */
// FULL is the off switch, and it is first because it is the honest default:
// the app shows what the arithmetic says you can spend. Every other entry is a
// voluntary handicap, so nobody should be sitting on one without having chosen
// it. The default used to be TIGHT, which quietly took 25% off the headline
// number of every user who never opened this screen, including on day one.
//
// Deliberately neutral in colour. The others earn a signal colour because they
// are a commitment being kept; "no reduction" is not an achievement.
export const SPEND_TIERS = [
  { id: 'FULL',   label: 'FULL AMOUNT', multiplier: 1.00, color: 'bg-input',      textColor: 'text-text-main', accent: '#9CA3AF' },
  { id: 'EASY',   label: '90% LIMIT',   multiplier: 0.90, color: 'bg-[#86EFAC]',  textColor: 'text-black',     accent: '#86EFAC' },
  { id: 'TIGHT',  label: '75% LIMIT',   multiplier: 0.75, color: 'bg-[#4ADE80]',  textColor: 'text-black',     accent: '#4ADE80' },
  { id: 'STRICT', label: '50% LIMIT',   multiplier: 0.50, color: 'bg-[#16A34A]',  textColor: 'text-white',     accent: '#16A34A' },
  { id: 'BARE',   label: '25% LIMIT',   multiplier: 0.25, color: 'bg-[#14532D]',  textColor: 'text-white',     accent: '#14532D' },
] as const;

export type SpendTierId = typeof SPEND_TIERS[number]['id'];

const TIER_IDS = new Set<string>(SPEND_TIERS.map(t => t.id));

/**
 * The tier commitment. Previously localStorage only, which meant clearing
 * browser data voided the lock and it never reached a second device.
 */
export interface TierLockState {
  tierId: SpendTierId;
  /** ISO timestamp, or null when no lock is running. */
  lockedUntil: string | null;
  /**
   * Days the current, or most recently finished, hold was set for. Without it
   * a running hold can only say how many days are left, never where you are in
   * it, and a finished one cannot say what it was.
   */
  lockedDays: number;
  /**
   * What the tier was taking off the daily allowance when the hold started.
   *
   * Captured at lock time because it cannot be recovered afterwards: the daily
   * figure moves with the balance and the days left, so by the time a hold
   * finishes there is no way to reconstruct what it withheld. Stored as a daily
   * rate rather than a total so it survives a hold being cut short.
   */
  dailyHoldback: number;
  /** Holds that ran to their end. */
  completed: number;
  /** Holds ended early. Was breakCount, which only ever counted this half. */
  broken: number;
  /**
   * A hold that has just finished and has not been acknowledged yet.
   *
   * Expiry used to be detected on load and thrown away in the same breath, so
   * the one moment the app could have noticed you finishing was also the moment
   * it erased the evidence. Failure, meanwhile, ran through an explicit action
   * that counted and persisted it. The app kept score of one thing only, which
   * is the difference between a record and a verdict.
   *
   * Both outcomes, stated the same way. Breaking already has its own
   * confirmation step, so this is not there to break the news; it is there so
   * the record covers both halves rather than only the one the app used to
   * count. The copy stays factual for both, with no praise on one side and no
   * reproach on the other.
   */
  pending: {
    result: 'completed' | 'broken';
    tierId: SpendTierId;
    /** Days actually served: the full term when completed, days elapsed when broken. */
    days: number;
    /** days x dailyHoldback. An estimate, and worded as one wherever it is shown. */
    heldBack: number;
  } | null;
}

export const DEFAULT_TIER_LOCK: TierLockState = {
  // Applies to anyone whose tier_lock column is still null, which is everyone
  // who has not deliberately picked a tier. An explicit choice writes a real
  // row, so this cannot overwrite one.
  tierId: 'FULL',
  lockedUntil: null,
  lockedDays: 0,
  dailyHoldback: 0,
  completed: 0,
  broken: 0,
  pending: null,
};

/**
 * Coerces the jsonb column into a usable shape. Rows written before the
 * migration come back null, and an older or hand-edited row can carry anything,
 * so every field is validated rather than trusted. An expired lock reads as no
 * lock, which is what makes the expiry self-healing without a scheduled job.
 */
export const normalizeTierLock = (raw: unknown, now: Date = new Date()): TierLockState => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_TIER_LOCK };
  const r = raw as Record<string, unknown>;

  const tierId = typeof r.tierId === 'string' && TIER_IDS.has(r.tierId)
    ? (r.tierId as SpendTierId)
    : DEFAULT_TIER_LOCK.tierId;

  const whole = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };

  // A hold in the future is still running. One in the past ran to its end
  // without being broken, because breaking clears lockedUntil outright, so the
  // two can never be confused for one another.
  let lockedUntil: string | null = null;
  let justFinished = false;
  if (typeof r.lockedUntil === 'string' && r.lockedUntil) {
    const when = new Date(r.lockedUntil);
    if (!Number.isNaN(when.getTime())) {
      if (when.getTime() > now.getTime()) lockedUntil = r.lockedUntil;
      else justFinished = true;
    }
  }

  const lockedDays = whole(r.lockedDays);
  const holdbackRaw = Number(r.dailyHoldback);
  const dailyHoldback = Number.isFinite(holdbackRaw) && holdbackRaw > 0 ? holdbackRaw : 0;
  // breakCount is the old name for the same figure. Read both so rows written
  // before the rename carry over without a migration.
  const broken = whole(r.broken ?? r.breakCount);

  let pending: TierLockState['pending'] = null;
  const rawPending = r.pending;
  if (rawPending && typeof rawPending === 'object') {
    const p = rawPending as Record<string, unknown>;
    if (typeof p.tierId === 'string' && TIER_IDS.has(p.tierId)) {
      const heldRaw = Number(p.heldBack);
      pending = {
        result: p.result === 'broken' ? 'broken' : 'completed',
        tierId: p.tierId as SpendTierId,
        days: whole(p.days),
        heldBack: Number.isFinite(heldRaw) && heldRaw > 0 ? heldRaw : 0,
      };
    }
  }

  // Deriving the increment from the STORED count rather than adding to a running
  // one keeps this idempotent: reading the same row twice yields the same
  // number, not two. The caller persists it once, after which lockedUntil is
  // null and there is nothing left to detect.
  let completed = whole(r.completed);
  if (justFinished) {
    completed += 1;
    pending = {
      result: 'completed',
      tierId,
      days: lockedDays,
      heldBack: dailyHoldback * lockedDays,
    };
  }

  return { tierId, lockedUntil, lockedDays, dailyHoldback, completed, broken, pending };
};

export const isTierLocked = (lock: TierLockState, now: Date = new Date()): boolean =>
  !!lock.lockedUntil && new Date(lock.lockedUntil).getTime() > now.getTime();

export const tierLockDaysLeft = (lock: TierLockState, now: Date = new Date()): number => {
  if (!lock.lockedUntil) return 0;
  const ms = new Date(lock.lockedUntil).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86400000));
};

export const calculateTierLimit = (safeSpendLimit: number, multiplier: number): number =>
  safeSpendLimit * multiplier;

export const calculateDangerProgress = (dailySpend: number, tierLimit: number): number => {
  if (tierLimit <= 0) return 0;
  return Math.min(110, (dailySpend / tierLimit) * 100);
};

export const calculateDailyDrain = (transactionsToday: any[]): number => {
  return transactionsToday
    .filter(tx => !DISCRETIONARY_CATEGORIES.has(tx.category))
    .reduce((acc, tx) => acc + tx.amount + tx.flipAmount, 0);
};

export const calculateDailySurplus = (safeSpendLimit: number, dailyDrain: number): number => {
  return safeSpendLimit - dailyDrain;
};

/**
 * 4. Active Subs (Implemented via store actions, but logic here)
 */
export const calculateNewBaselineBills = (currentBills: number, subCost: number): number => {
  return currentBills - subCost;
};

export const calculateNewWealthTarget = (currentGoal: number, subCost: number): number => {
  return currentGoal + subCost;
};

/**
 * 5. Vaults & The Tactical Strategy
 */
export const calculateVaultProgress = (current: number, target: number): number => {
  if (target <= 0) return 0;
  return Math.min(100, (current / target) * 100);
};

// Amount a vault holds above its target. Progress is deliberately clamped to 100
// for the bar, which means overshoot is invisible unless it is read separately.
export const calculateVaultOvershoot = (current: number, target: number): number =>
  target > 0 ? Math.max(0, current - target) : 0;

// Where automatic deposits land: the surplus sweep in setHorizon and the
// overspend penalty in logSpend. Both previously took vaults[0], which had two
// problems. The query had no ORDER BY, so "first" was whatever Postgres happened
// to return and could shift between sessions; and completion was never checked,
// so money kept flowing into a goal already met while unfinished vaults got
// nothing. A vault with no target set (target <= 0) is never "complete" and stays
// eligible. Falls back to the first vault when every goal is met, since leaving
// the money liquid would defeat the point of intercepting it.
// `excludeIds` carries the deposit-locked vaults on a lapsed free account. An
// automatic sweep into a locked vault would be the same deposit the lock exists
// to prevent, just arriving by a different route.
export const pickAutoDepositVault = <T extends { id?: string; current: number; target: number }>(
  vaults: T[],
  excludeIds?: Set<string>,
): T | null => {
  const eligible = excludeIds && excludeIds.size > 0
    ? vaults.filter(v => !v.id || !excludeIds.has(v.id))
    : vaults;
  if (eligible.length === 0) return null;
  return eligible.find(v => v.target <= 0 || v.current < v.target) ?? eligible[0];
};

// Cash that can actually be moved into a vault: liquid assets minus what's
// already earmarked for upcoming bills. Single source of truth so the Vaults
// "Available to Vault" card, the Fund sheet, and the funding guard all agree.
export const calculateAvailableToVault = (liquidAssets: number, upcomingBills: number): number => {
  return Math.max(0, liquidAssets - (upcomingBills || 0));
};

export const calculateSalaryDelta = (current: number, target: number): number => {
  return Math.max(0, target - current);
};

// FV = PMT × ((1 + r)^n − 1) / r
// PMT = monthly contribution, r = monthly return (7% annual), n = 120 months
export const calculate10YearCompoundCapture = (grossDelta: number, redirectRate = UNIVERSAL_FLIP_RATE): number => {
  const annualContribution = grossDelta * redirectRate;
  const pmt = annualContribution / 12;
  const r = 0.07 / 12;
  const n = 120;
  if (pmt <= 0) return 0;
  return pmt * ((Math.pow(1 + r, n) - 1) / r);
};

/**
 * 6. The Tactical Splitter
 */
export const calculateTacticalSplit = (totalBill: number, activeMemberCount: number): SplitBreakdown => {
  if (activeMemberCount <= 0 || totalBill <= 0) {
    return {
      activeMemberCount,
      baseSharePerPerson: 0,
      flipObligationPerPerson: 0,
      totalHitPerPerson: 0
    };
  }

  const baseSharePerPerson = totalBill / activeMemberCount;
  const flipObligationPerPerson = baseSharePerPerson * UNIVERSAL_FLIP_RATE;
  const totalHitPerPerson = baseSharePerPerson + flipObligationPerPerson;

  return {
    activeMemberCount,
    baseSharePerPerson,
    flipObligationPerPerson,
    totalHitPerPerson
  };
};
