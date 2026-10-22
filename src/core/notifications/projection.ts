// =========================================================================
// Booking alerts ahead of time, for the phone app.
//
// StackPiggy has no bank feed: every figure is typed in by the user, so while
// the app is closed nothing about their money changes except the date. That
// makes the date-driven alerts predictable, and this file predicts them by
// asking the real engine (`evaluate`) what it would say at fixed moments over
// the coming week, carrying a projected log forward so the daily and weekly
// caps, cooldowns and quiet hours all hold across the whole plan.
//
// Only rules whose outcome is driven by the calendar are projected. The risk
// rules depend on figures that may well change before their slot, so they stay
// live-only rather than buzz someone with a stale warning.
//
// Pure: no OS, no storage, no clock. The native adapter books the result.
// =========================================================================

import { toLocalDateKey } from '../math';
import type { Transaction } from '../../store/useStore';
import { evaluate } from './engine';
import { isQuietHour } from './policy';
import { RULES, type NotificationStateSlice } from './rules';
import type { NotificationLogState, NotificationPrefs, ScheduledAlert } from './types';

const PROJECTED_RULES = new Set(['bill-due-soon', 'payday-landed', 'daily-review-due']);

// Morning for anything about the day ahead (bills, payday); early evening for
// the daily review, matching the hour that rule already opens at.
const SLOT_HOURS = [9, 18];
const HORIZON_DAYS = 7;

// Never book something about to fire: the live tick covers the next few minutes.
const MIN_LEAD_MS = 5 * 60 * 1000;

// Stable 31-bit id per booking, so the same alert keeps the same OS id across
// re-plans (Android and iOS both want a positive 32-bit integer).
export function osIdFor(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2147483647 || 1;
}

const sameDay = (iso: string, at: Date) => !!iso && iso.slice(0, 10) === toLocalDateKey(at);

export function planSchedule(
  slice: NotificationStateSlice,
  prefs: NotificationPrefs,
  log: NotificationLogState,
  now: Date,
): ScheduledAlert[] {
  if (prefs.mode === 'off' || !slice.isConfigured || !slice.hasCompletedOnboarding) return [];

  const rules = RULES.filter(r => PROJECTED_RULES.has(r.id));
  const cooldownOf = new Map(rules.map(r => [r.id, r.cooldownHours]));
  let projected: NotificationLogState = { ...log, scheduled: undefined };
  const plan: ScheduledAlert[] = [];

  for (let day = 0; day <= HORIZON_DAYS; day++) {
    for (const hour of SLOT_HOURS) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour, 0, 0, 0);
      if (at.getTime() - now.getTime() < MIN_LEAD_MS) continue;
      if (isQuietHour(at, prefs.quietHours)) continue;

      // The pay is only credited once the app opens on payday, so the payday
      // rule would never see it. A stand-in credit lets the rule fire on the
      // right day; its wording is replaced below because the real figures are
      // not known yet.
      const paydayStandIn: Transaction[] = sameDay(slice.nextPayday, at)
        ? [{
            id: 'projected-payday',
            merchant: 'PAYDAY',
            category: 'INCOME',
            amount: slice.monthlyTakeHome,
            date: at.toISOString(),
          } as Transaction]
        : [];
      const slotSlice: NotificationStateSlice = {
        ...slice,
        transactions: [...paydayStandIn, ...slice.transactions],
      };

      const { records, nextLog } = evaluate(slotSlice, prefs, projected, at, rules);
      projected = nextLog;

      for (const r of records) {
        const record = r.ruleId === 'payday-landed'
          ? { ...r, title: 'It is payday', body: "Open StackPiggy to add your pay and see what's cleared for today." }
          : r;
        plan.push({
          osId: osIdFor(`${record.dedupeKey}@${record.createdAt}`),
          at: at.toISOString(),
          record: { ...record, origin: 'scheduled' },
          cooldownHours: cooldownOf.get(r.ruleId) ?? 48,
        });
      }
    }
  }
  return plan;
}

// A cheap identity for a plan, so the OS is only re-booked when it changed.
export const planSignature = (plan: ScheduledAlert[]): string =>
  plan.map(p => `${p.osId}:${p.at}:${p.record.title}:${p.record.body}`).join('|');
