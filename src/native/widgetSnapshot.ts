import type { AppState } from '../store/useStore';
import { dailyDiscretionarySpend } from '../core/clearedToday';
import { currencyDef } from '../lib/currency';

export interface WidgetSnapshot {
  version: 1;
  amountText: string;
  hidden: boolean;
  updatedAt: number;
  expiresAt: number;
}

export function makeWidgetSnapshot(state: AppState, now = new Date()): WidgetSnapshot | null {
  if (!state.userId || !state.dataFresh || !state.hasCompletedOnboarding || !state.nextPayday) return null;
  const hidden = state.privacyMode || state.lockEnabled || state.isLocked;
  const remaining = Math.max(0, state.safeSpendLimit - dailyDiscretionarySpend(state.transactions, now));
  if (!Number.isFinite(remaining)) return null;
  const currency = currencyDef(state.currency);
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return {
    version: 1,
    // Never send an unmasked amount to native storage while privacy/lock is on.
    amountText: hidden ? '' : new Intl.NumberFormat(currency.locale, {
      style: 'currency', currency: currency.code,
    }).format(remaining),
    hidden,
    updatedAt: now.getTime(),
    expiresAt: midnight.getTime(),
  };
}
