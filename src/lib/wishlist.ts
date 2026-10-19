// A list for wanting things without buying them.
//
// A normal wishlist helps you shop, which would work against this product. This
// one is a holding place: you write the thing down, you see what it costs in
// days of your own cleared amount, and you come back to it later.
//
// Two rules are load-bearing and easy to undo by accident:
//
//   No totals. Summing what you want produces a guilt number, and summing what
//   you passed on produces a vanity one. Neither describes anything that
//   happened, so neither is here.
//
//   Passing on something is not an achievement. The app does not congratulate
//   it. An item you dropped is one you did not want enough, which is ordinary.
//
// Pure logic only, with no imports, so it can be exercised without a browser or
// a store. Reading and writing live in personalStorage.

export const NAME_MAX_LENGTH = 60;
export const REASON_MAX_LENGTH = 80;

export type WishlistState = 'wanted' | 'bought' | 'dropped';

export interface WishlistItem {
  id: string;
  name: string;
  amount: number;
  /** Optional one line: why you want it. Often the most useful part later. */
  reason?: string;
  /** Local date key it was added, so the list can show how long it has sat. */
  addedOn: string;
  state: WishlistState;
  /** Set when "Save for it" turned this item into a vault (migration 026). */
  vaultId?: string;
}

export function isWishlistItem(v: unknown): v is WishlistItem {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === 'string'
    && typeof o.name === 'string'
    && typeof o.amount === 'number'
    && Number.isFinite(o.amount)
    && typeof o.addedOn === 'string'
    && (o.state === 'wanted' || o.state === 'bought' || o.state === 'dropped');
}

/**
 * The price in days of the user's own cleared amount.
 *
 * This is the app's native unit. TrueCost converts into workdays of pay, but
 * that asks the user to type an hourly wage every time, so it is a calculator
 * rather than a unit the whole app can speak. Cleared-per-day is already on the
 * dashboard and already in the daily review, and needs nothing typed.
 *
 * Returns null when there is no daily figure yet, so the caller can leave the
 * lens off rather than print a meaningless number.
 */
export function daysOfCleared(amount: number, dailyCleared: number): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!Number.isFinite(dailyCleared) || dailyCleared <= 0) return null;
  return amount / dailyCleared;
}

/** "about 4 days", "less than a day", "about 1 day" — never a bare decimal. */
export function describeDays(days: number | null): string | null {
  if (days === null) return null;
  if (days < 0.75) return 'less than a day';
  const rounded = Math.round(days);
  if (rounded <= 1) return 'about 1 day';
  if (rounded > 365) return 'more than a year';
  return `about ${rounded} days`;
}

/** Whole days an item has been sitting, for the list to show without judging. */
export function daysSince(addedOn: string, today: Date = new Date()): number {
  const [y, m, d] = addedOn.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const added = new Date(y, m - 1, d);
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((now.getTime() - added.getTime()) / 86_400_000));
}
