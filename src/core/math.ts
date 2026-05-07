import { AppState } from '../store/useStore';
import { SplitBreakdown } from '../types/split';

/**
 * 1. The Core Engine (Dynamic Recalibration)
 */
export const calculateTotalMonthlyDiscretionary = (state: AppState): number => {
  return state.monthlyTakeHome - state.fixedBills - state.monthlySavingsGoal;
};

export const calculateRemainingCashRunway = (state: AppState): number => {
  const totalDiscretionary = calculateTotalMonthlyDiscretionary(state);
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const spentThisMonth = state.transactions
    .filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    })
    .reduce((acc, tx) => acc + tx.amount + tx.flipAmount, 0);

  const stashedThisMonth = state.reconHistory
    .filter(entry => {
       const entryDate = new Date(entry.date);
       return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
    })
    .filter(entry => entry.action === 'stash')
    .reduce((acc, entry) => acc + entry.surplus, 0);

  return totalDiscretionary - spentThisMonth - stashedThisMonth;
};

export const calculateRemainingDaysInMonth = (): number => {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate() + 1;
};

export const calculateTrueSafeSpend = (state: AppState): number => {
  const totalDiscretionaryTotal = calculateTotalMonthlyDiscretionary(state);
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const todayDate = now.getDate();
  
  // 1. Calculate what was spent this month BEFORE today
  const spentBeforeToday = state.transactions
    .filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === currentMonth && 
             txDate.getFullYear() === currentYear &&
             txDate.getDate() < todayDate;
    })
    .reduce((acc, tx) => acc + tx.amount + tx.flipAmount, 0);

  // 2. Calculate what was stashed BEFORE today
  const stashedBeforeToday = state.reconHistory
    .filter(entry => {
       const entryDate = new Date(entry.date);
       return entryDate.getMonth() === currentMonth && 
              entryDate.getFullYear() === currentYear &&
              entryDate.getDate() < todayDate;
    })
    .filter(entry => entry.action === 'stash')
    .reduce((acc, entry) => acc + entry.surplus, 0);

  // 3. Current Month Runway at START of today
  const runwayAtStartOfToday = totalDiscretionaryTotal - spentBeforeToday - stashedBeforeToday;
  
  // 4. Days left including today
  const daysLeft = calculateRemainingDaysInMonth();
  
  // 5. Daily budget for today (and following days if nothing else changes)
  const baseBudgetForToday = Math.max(0, runwayAtStartOfToday / daysLeft);
  
  // 6. What was spent TODAY
  const spentToday = state.transactions
    .filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === currentMonth && 
             txDate.getFullYear() === currentYear &&
             txDate.getDate() === todayDate;
    })
    .reduce((acc, tx) => acc + tx.amount + tx.flipAmount, 0);
    
  // 7. Safe to spend today
  const safeToday = baseBudgetForToday - spentToday;

  // We still have rollover and extra cash
  const finalResult = safeToday + (state.rolloverPool || 0) + (state.extraCashPool || 0);
  
  return Math.max(0, finalResult);
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

export const calculateGremlinPenalty = (amount: number, penaltyRate: number): number => {
  return amount * penaltyRate;
};

export const calculateGremlinDeduction = (amount: number, penaltyRate: number): number => {
  return amount + calculateGremlinPenalty(amount, penaltyRate);
};

/**
 * 3. The Nightly Recon
 */
export const calculateDailyDrain = (transactionsToday: any[]): number => {
  return transactionsToday.reduce((acc, tx) => {
    // If it was a gremlin purchase, it would have been recorded differently or we check category
    // For this context, we assume flipAmount already contains the penalty/tax
    return acc + tx.amount + tx.flipAmount;
  }, 0);
};

export const calculateDailySurplus = (safeSpendLimit: number, dailyDrain: number): number => {
  return safeSpendLimit - dailyDrain;
};

/**
 * 4. The Leech List (Implemented via store actions, but logic here)
 */
export const calculateNewBaselineBills = (currentBills: number, leechCost: number): number => {
  return currentBills - leechCost;
};

export const calculateNewWealthTarget = (currentGoal: number, leechCost: number): number => {
  return currentGoal + leechCost;
};

/**
 * 5. Vaults & The Tactical Strategy
 */
export const calculateVaultProgress = (current: number, target: number): number => {
  if (target <= 0) return 0;
  return Math.min(100, (current / target) * 100);
};

export const calculateSalaryDelta = (current: number, target: number): number => {
  return Math.max(0, target - current);
};

export const calculate10YearCompoundCapture = (grossDelta: number): number => {
  // Gross Delta × 0.20 × 10
  return grossDelta * UNIVERSAL_FLIP_RATE * 10;
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
