import { StoreState } from '../store/useStore';

export function runPaydayCheck(store: StoreState): void {
  // Never run against a cache-hydrated (or empty) store. A snapshot saved before
  // another device processed this payday still carries the old nextPayday, and
  // acting on it would credit the income and insert the PAYDAY transaction a
  // second time. Wait for Supabase to confirm the cycle.
  if (!store.dataFresh) return;
  if (!store.isConfigured || !store.nextPayday || store.monthlyTakeHome <= 0) return;

  const [year, month, day] = store.nextPayday.split('-').map(Number);
  const payday = new Date(year, month - 1, day);
  payday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today >= payday) {
    store.processPayday();
  }
}
