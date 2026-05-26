import { supabase } from './supabase';

export async function pushTransactions(rows: Record<string, unknown>[]): Promise<void> {
  if (!rows.length) return;
  try {
    await (supabase.from('transactions') as any).insert(rows);
  } catch { /* silently fail */ }
}

export async function pushProfileUpdate(userId: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await (supabase.from('profiles') as any).update(payload).eq('id', userId);
  } catch { /* silently fail */ }
}

export async function pushVaultUpdate(vaultId: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await (supabase.from('vaults') as any).update(payload).eq('id', vaultId);
  } catch { /* silently fail */ }
}

export async function pushVaultInsert(userId: string, row: Record<string, unknown>): Promise<void> {
  try {
    await (supabase.from('vaults') as any).insert({ ...row, user_id: userId });
  } catch { /* silently fail */ }
}

export async function pushReconEntry(userId: string, row: Record<string, unknown>): Promise<void> {
  try {
    await (supabase.from('recon_history') as any).insert({ ...row, user_id: userId });
  } catch { /* silently fail */ }
}
