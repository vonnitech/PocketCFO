// Single source of truth for the dashboard widget list.
//
// This list used to exist in four places that had drifted apart: the store's
// INITIAL_STATE (3 widgets), Settings' WIDGET_META (3), a dead copy in types.ts
// (4), and the profiles.dashboard_widgets column default (4). The two four-entry
// copies still carried a 'momentum' widget that was removed from the UI in
// 811b294, so the app was seeding new accounts with a widget nothing renders.
//
// Every runtime consumer now derives from this array. The SQL column default is
// the one copy that cannot import it; migration 013 realigns it, and it only
// affects rows created before the client first writes its own list.

export interface DashboardWidgetMeta {
  id: string;
  label: string;
  description: string;
}

export const DASHBOARD_WIDGETS: DashboardWidgetMeta[] = [
  { id: 'safe-spend',   label: 'Daily Safe Spend', description: 'Your main spending limit hero card' },
  { id: 'vault-status', label: 'Savings Overview', description: 'Vaulted & spendable balance pillars' },
  { id: 'alert',        label: 'Bill Queue',       description: 'Upcoming bills checklist' },
];

// Returns a fresh array each call. INITIAL_STATE is shallow-spread in several
// places (sign-out reset, Settings import), so handing out one shared reference
// would let a stray mutation rewrite the defaults for the rest of the session.
export const defaultDashboardWidgets = (): { id: string; visible: boolean }[] =>
  DASHBOARD_WIDGETS.map(w => ({ id: w.id, visible: true }));
