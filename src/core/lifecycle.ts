import { StoreState } from '../store/useStore';

export function runPaydayCheck(store: StoreState): void {
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
