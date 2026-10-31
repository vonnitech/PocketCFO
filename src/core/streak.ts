// =========================================================================
// Daily review streak.
//
// Counted from saved reviews on every render, never stored as a counter, so it
// cannot drift or reset on reload (the bug the achievements had).
//
// The streak rewards showing up, not spending perfectly: any day with a Daily
// review counts, whatever was spent.
//
// Forgiveness: ONE missed day per pay cycle is covered automatically, as long
// as it is a single day between two reviewed days (or yesterday, while today is
// still open). Two missed days in a row end the streak. There is no way to
// fill in a missed day afterwards: a review is a check-in on that day.
//
// Pay cycles are counted from the payday's day of the month (the anchor), so a
// "cycle" is anchor day to the day before the next anchor day. Months shorter
// than the anchor use their last day.
// =========================================================================

import { toLocalDateKey } from './math';

export interface StreakInfo {
  /** Days in the live streak, including today if reviewed. Covered days do not add to it. */
  current: number;
  /** Longest streak in the loaded history (at least `current`). */
  longest: number;
  /** Today has a review. */
  reviewedToday: boolean;
  /** Yesterday was missed and is covered by this cycle's free day. */
  yesterdayCovered: boolean;
  /** The current pay cycle's free day is still unused. */
  freeDayLeft: boolean;
}

const DAY_MS = 86_400_000;

// Day keys are local "YYYY-MM-DD". Reading them as UTC midnight gives whole day
// numbers (no daylight-saving drift), and keyFromDayNumber is its exact inverse.
const dayNumber = (key: string): number => Math.floor(Date.parse(`${key}T00:00:00Z`) / DAY_MS);
const keyFromDayNumber = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10);

const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The pay cycle a day falls in, named by the year-month in which that cycle started. */
export const payCycleOf = (key: string, anchorDay: number): string => {
  const [y, m, d] = key.split('-').map(Number);
  const anchor = Math.min(Math.max(1, anchorDay || 1), daysInMonth(y, m));
  if (d >= anchor) return `${y}-${m}`;
  return m === 1 ? `${y - 1}-12` : `${y}-${m - 1}`;
};

/** The payday's day of the month: the stored anchor, else the next payday's day, else the 1st. */
export const streakAnchorDay = (paydayAnchorDay: number, nextPayday: string): number => {
  if (paydayAnchorDay >= 1 && paydayAnchorDay <= 31) return paydayAnchorDay;
  const d = Number(String(nextPayday || '').slice(8, 10));
  return d >= 1 && d <= 31 ? d : 1;
};

export const computeStreak = (
  reviewDates: readonly string[],
  anchorDay: number,
  now: Date = new Date(),
): StreakInfo => {
  const today = dayNumber(toLocalDateKey(now));
  const days = [...new Set(reviewDates.map(toLocalDateKey).filter(Boolean))]
    .map(dayNumber)
    .filter(n => Number.isFinite(n) && n <= today)
    .sort((a, b) => a - b);

  // One free day per pay cycle, shared by every run in that cycle: a cycle
  // that already forgave a day (even in a streak that later ended) has none left.
  const usedCycles = new Set<string>();
  const cycle = (n: number) => payCycleOf(keyFromDayNumber(n), anchorDay);

  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const n of days) {
    const gap = prev === null ? Infinity : n - prev;
    if (gap === 1) {
      run += 1;
    } else if (gap === 2 && !usedCycles.has(cycle(n - 1))) {
      usedCycles.add(cycle(n - 1));
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = n;
  }

  const last = prev;
  const reviewedToday = last === today;
  let current = 0;
  let yesterdayCovered = false;
  if (last !== null) {
    if (last >= today - 1) {
      current = run;
    } else if (last === today - 2 && !usedCycles.has(cycle(today - 1))) {
      // Yesterday was missed but today is still open: the free day covers it.
      usedCycles.add(cycle(today - 1));
      yesterdayCovered = true;
      current = run;
    }
  }

  return {
    current,
    longest: Math.max(longest, current),
    reviewedToday,
    yesterdayCovered,
    freeDayLeft: !usedCycles.has(cycle(today)),
  };
};
