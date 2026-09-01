// Public surface of the notification system. Import from here, not from the
// individual files, so the internals can be rearranged (and the persistence
// layer swapped for the server) without touching call sites.

export * from './types';
export { POLICY, DEFAULT_QUIET_HOURS, isQuietHour, budgetUsage } from './policy';
export { permissionState, requestPermission, deliverTest, isSupported } from './permission';
export type { PermissionState } from './permission';
export { recordSyncFailure, recordSyncSuccess, readSyncHealth } from './health';
export { RULES } from './rules';
export { assessRisk, decideEscalation, severityStep, RISK, HIGH_RISK_LEVEL } from './risk';
export type { RiskAssessment, RiskLevel } from './risk';
export type { NotificationStateSlice } from './rules';
export {
  subscribe,
  subscribeToEmissions,
  initForUser,
  getPrefs,
  getRecords,
  getUnreadCount,
  setMode,
  setCategoryEnabled,
  setQuietHours,
  markPrimerAnswered,
  markRead,
  markAllRead,
  clearInbox,
  evaluate,
  tick,
} from './engine';
