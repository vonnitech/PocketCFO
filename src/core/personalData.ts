// Reads and writes for the journal and the wishlist.
//
// Both live in Supabase rather than on the device. A journal is only worth
// keeping if you can look back over weeks, and a list of things you want is
// only useful if it is there on the phone you are holding in the shop. Browser
// storage gives neither.
//
// The trade is that these rows are on a server, so the privacy policy says so
// plainly rather than claiming they never leave the device. Row level security
// restricts every query to the signed-in user's own rows.

import { supabase } from './supabase';
import { isMood, type JournalEntry, type Mood } from '../lib/journal';
import { isWishlistItem, type WishlistItem, type WishlistState } from '../lib/wishlist';

// ── journal ─────────────────────────────────────────────────────────────────

interface JournalRow {
  id: string;
  entry_date: string;
  note: string | null;
  mood: string | null;
  no_spend: boolean | null;
}

function toEntry(row: JournalRow): JournalEntry {
  return {
    id:        String(row.id),
    entryDate: String(row.entry_date),
    note:      typeof row.note === 'string' ? row.note : '',
    mood:      isMood(row.mood) ? row.mood : null,
    noSpend:   row.no_spend === true,
  };
}

/** Most recent first. `limit` keeps the recap's window small and predictable. */
export async function fetchJournal(userId: string, limit = 30): Promise<JournalEntry[]> {
  const { data, error } = await (supabase.from('journal_entries') as any)
    .select('id, entry_date, note, mood, no_spend')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return (data as JournalRow[]).map(toEntry);
}

/**
 * Writes the entry for one day.
 *
 * Upserted on (user_id, entry_date) so writing again on the same day edits that
 * day rather than stacking entries, which is what keeps a recap readable. An
 * entry emptied of everything is deleted instead, so clearing a line removes it
 * rather than leaving a blank row that counts towards "days written".
 */
export async function saveJournalEntry(
  userId: string,
  entryDate: string,
  note: string,
  mood: Mood | null,
  noSpend: boolean,
): Promise<boolean> {
  const trimmed = note.trim();
  if (!trimmed && mood === null && !noSpend) {
    const { error } = await (supabase.from('journal_entries') as any)
      .delete().eq('user_id', userId).eq('entry_date', entryDate);
    return !error;
  }

  const { error } = await (supabase.from('journal_entries') as any)
    .upsert({
      user_id:    userId,
      entry_date: entryDate,
      note:       trimmed || null,
      mood,
      no_spend:   noSpend,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,entry_date' });
  return !error;
}

// ── wishlist ────────────────────────────────────────────────────────────────

interface WishlistRow {
  id: string;
  name: string;
  amount: number | string;
  reason: string | null;
  added_on: string;
  state: string;
  // Migration 026. Absent on a database that has not run it yet.
  vault_id?: string | null;
}

// Reads use * rather than a column list so that the optional vault_id column
// (migration 026) is picked up when present without breaking the wishlist on a
// database that has not run it. Naming a missing column fails the whole query.
const WISHLIST_COLUMNS = '*';

function toItem(row: WishlistRow): WishlistItem | null {
  const candidate = {
    id:      String(row.id),
    name:    String(row.name),
    amount:  Number(row.amount),
    reason:  typeof row.reason === 'string' && row.reason ? row.reason : undefined,
    addedOn: String(row.added_on),
    state:   String(row.state),
    vaultId: typeof row.vault_id === 'string' && row.vault_id ? row.vault_id : undefined,
  };
  // Validated rather than trusted: the column is a text check constraint, and a
  // hand-edited row should be skipped rather than reach the rest of the app.
  return isWishlistItem(candidate) ? candidate : null;
}

export async function fetchWishlist(userId: string): Promise<WishlistItem[]> {
  const { data, error } = await (supabase.from('wishlist_items') as any)
    .select(WISHLIST_COLUMNS)
    .eq('user_id', userId)
    .order('added_on', { ascending: false });
  if (error || !Array.isArray(data)) return [];
  return (data as WishlistRow[]).map(toItem).filter((i): i is WishlistItem => i !== null);
}

export async function addWishlistItem(
  userId: string,
  name: string,
  amount: number,
  reason: string | undefined,
  addedOn: string,
): Promise<WishlistItem | null> {
  const { data, error } = await (supabase.from('wishlist_items') as any)
    .insert({ user_id: userId, name, amount, reason: reason || null, added_on: addedOn, state: 'wanted' })
    .select(WISHLIST_COLUMNS)
    .single();
  if (error || !data) return null;
  return toItem(data as WishlistRow);
}

export async function setWishlistState(
  userId: string, id: string, state: WishlistState,
): Promise<boolean> {
  const { error } = await (supabase.from('wishlist_items') as any)
    .update({ state }).eq('user_id', userId).eq('id', id);
  return !error;
}

/**
 * Records that "Save for it" turned this item into a vault, and takes it off
 * the wanted list. Returns whether the link itself was stored.
 *
 * If the database has not run migration 026 the combined write fails on the
 * unknown column, so it falls back to the state change alone. The item still
 * leaves the wanted list either way; only the vault's tag is missing.
 */
export async function linkWishlistToVault(
  userId: string, id: string, vaultId: string,
): Promise<boolean> {
  const { error } = await (supabase.from('wishlist_items') as any)
    .update({ state: 'bought', vault_id: vaultId }).eq('user_id', userId).eq('id', id);
  if (!error) return true;
  await setWishlistState(userId, id, 'bought');
  return false;
}

export async function removeWishlistItem(userId: string, id: string): Promise<boolean> {
  const { error } = await (supabase.from('wishlist_items') as any)
    .delete().eq('user_id', userId).eq('id', id);
  return !error;
}
