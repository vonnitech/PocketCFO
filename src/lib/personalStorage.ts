// Reading and writing for the two personal features: the payday note and the
// wishlist.
//
// Both stay on the device. They are the most personal things in the app, a
// sentence someone wrote to themselves and a list of things they want, and
// neither needs to leave the browser to do its job. Keeping them local also
// means the privacy policy's claim about them is true without qualification.
//
// The trade is that they do not follow you between devices. That is worth
// revisiting once it is clear anyone uses them, and not before.

import { userKey } from './userScopedStorage';
import { NOTE_MAX_LENGTH, type PaydayNote } from './paydayNote';
import { isWishlistItem, type WishlistItem } from './wishlist';

export const PAYDAY_NOTE_BASE = 'stackpiggy-payday-note-v1';
export const WISHLIST_BASE    = 'stackpiggy-wishlist-v1';

// ── payday note ─────────────────────────────────────────────────────────────

export function readPaydayNote(): PaydayNote | null {
  try {
    const raw = localStorage.getItem(userKey(PAYDAY_NOTE_BASE));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PaydayNote>;
    const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
    if (!text) return null;
    return { text, writtenOn: typeof parsed.writtenOn === 'string' ? parsed.writtenOn : '' };
  } catch {
    // Unparseable, or storage unavailable. A missing note is a normal state.
    return null;
  }
}

export function writePaydayNote(text: string, writtenOn: string): void {
  const trimmed = text.trim().slice(0, NOTE_MAX_LENGTH);
  try {
    if (!trimmed) {
      localStorage.removeItem(userKey(PAYDAY_NOTE_BASE));
      return;
    }
    localStorage.setItem(userKey(PAYDAY_NOTE_BASE), JSON.stringify({ text: trimmed, writtenOn }));
  } catch {
    // Storage blocked. Losing the note is better than breaking the save it rode in on.
  }
}

// ── wishlist ────────────────────────────────────────────────────────────────

export function readWishlist(): WishlistItem[] {
  try {
    const raw = localStorage.getItem(userKey(WISHLIST_BASE));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Filtering rather than failing: one corrupt row should not empty the list.
    return Array.isArray(parsed) ? parsed.filter(isWishlistItem) : [];
  } catch {
    return [];
  }
}

export function writeWishlist(items: WishlistItem[]): void {
  try {
    localStorage.setItem(userKey(WISHLIST_BASE), JSON.stringify(items));
  } catch {
    // Storage blocked or full. The list in memory still works for this session.
  }
}
