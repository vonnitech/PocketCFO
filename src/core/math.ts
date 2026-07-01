import { AppState, Transaction } from '../store/useStore';
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
const DISCRETIONARY_CATEGORIES = new Set(['SAVINGS', 'VAULT_DEPOSIT', 'DEBT_PAYMENT', 'BILL_PAYMENT', 'INCOME', 'VAULT_TRANSFER', 'VAULT_WITHDRAWAL']);

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

  // Bills are reserved out of current cash only if the balance can cover them;
  // otherwise they're funded by the next paycheck and don't squeeze pre-payday spend.
  const upcoming = state.upcomingBills || 0;
  const billsToReserve = state.liquidAssets >= upcoming ? upcoming : 0;
  // Cash safety: never green-light spending more than the current balance can sustain
  // until payday (after reserving any unpaid bills).
  const dailyFromCash = (state.liquidAssets - billsToReserve) / days;

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

export const calculateTrueSafeSpend = (state: AppState): number => {
  const raw = calculateRawSafeSpend(state);
  const cap = state.hardDailyCap ?? 0;
  return cap > 0 ? Math.min(raw, cap) : raw;
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
export const SPEND_TIERS = [
  { id: 'EASY',   label: '90% LIMIT', multiplier: 0.90, color: 'bg-action-capture', textColor: 'text-capture-contrast',  accent: '#00CC55' },
  { id: 'TIGHT',  label: '75% LIMIT', multiplier: 0.75, color: 'bg-[#facc15]',      textColor: 'text-black',  accent: '#facc15' },
  { id: 'STRICT', label: '50% LIMIT', multiplier: 0.50, color: 'bg-orange-400',     textColor: 'text-black',  accent: '#fb923c' },
  { id: 'BARE',   label: '25% LIMIT', multiplier: 0.25, color: 'bg-action-bleed',   textColor: 'text-white',  accent: '#FF4D4D' },
] as const;

export type SpendTierId = typeof SPEND_TIERS[number]['id'];

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
