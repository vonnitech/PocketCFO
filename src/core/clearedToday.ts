import { toLocalDateKey } from './math';
import type { Transaction } from '../store/useStore';

// One definition for the dashboard and native widgets. Reserved obligations and
// transfers must never consume the daily allowance twice.
export const RESERVED_CATEGORIES = new Set([
  'SAVINGS', 'VAULT_DEPOSIT', 'PENALTY', 'VAULT_TRANSFER', 'VAULT_WITHDRAWAL',
  'BILL_PAYMENT', 'SUBSCRIPTION_PAYMENT', 'DEBT_PAYMENT',
]);

export function dailyDiscretionarySpend(transactions: Transaction[], date: Date): number {
  const key = toLocalDateKey(date);
  return transactions
    .filter(tx => toLocalDateKey(tx.date) === key &&
      !RESERVED_CATEGORIES.has(tx.category) && tx.category !== 'INCOME')
    .reduce((sum, tx) => sum + tx.amount, 0);
}
