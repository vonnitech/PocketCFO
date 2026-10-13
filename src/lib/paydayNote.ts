// A line written on payday, read later in the cycle.
//
// The point is the gap between the two moments. Payday-you is flush and
// generous; day-twenty-four-you is not. The note is that person giving
// themselves permission across time, in words rather than numbers.
//
// Pure logic only, with no imports. Reading and writing live in personalStorage.

export const NOTE_MAX_LENGTH = 140;

export interface PaydayNote {
  text: string;
  /** Local date key for the day it was written, so the card can say when. */
  writtenOn: string;
}

/**
 * Whether the note should be on screen right now.
 *
 * Shown when the day is getting thin, because that is when a reminder of your
 * own intent is worth something. Deliberately NOT shown once the day is already
 * overspent: at that point the same sentence stops being encouragement and
 * becomes "remember what you said?", which is the one thing it must never be.
 */
export function shouldSurfaceNote(spendRemaining: number, dailyLimit: number): boolean {
  if (dailyLimit <= 0) return false;
  if (spendRemaining < 0) return false;          // overspent: stay quiet
  return spendRemaining <= dailyLimit * 0.25;    // the last quarter of the day's room
}
