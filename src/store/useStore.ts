// =========================================================================
// ARCHITECT SIGNATURE: Proverbs 27:23
// "Be diligent to know the state of your flocks, and look well to your herds."
// =========================================================================

import { create } from 'zustand';
import { SquadMember, SplitTransaction, CustomSplitPreset } from '../types/split';
import { calculateTrueSafeSpend, calculateRawSafeSpend, UNIVERSAL_FLIP_RATE, toLocalDateKey } from '../core/math';
import { supabase } from '../core/supabase';
import { pushTransactions, pushProfileUpdate, pushVaultUpdate, pushVaultInsert, pushReconEntry } from '../core/sync';
import { setActiveCurrency } from '../lib/currency';
import { SpendTierId } from '../core/math';

// Prevents concurrent processPayday calls from double-crediting income when
// runPaydayCheck fires multiple times before the first async call completes.
let _paydayProcessing = false;

export interface Transaction {
  id: string;
  merchant: string;
  amount: number;
  category: string;
  date: string;
  isFlip: boolean;
  flipAmount: number;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  usage: 'Active' | 'Low Use' | 'Idle';
  billingCycle: 'Monthly' | 'Yearly';
}

export type VaultAssetClass = 'INVESTMENT' | 'SINKING_FUND' | 'CASH_RESERVE';

export interface Vault {
  id: string;
  name: string;
  target: number;
  current: number;
  asset_class: VaultAssetClass;
}

export interface Debt {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minPayment: number;
}

export interface Impulse {
  id: string;
  name: string;
  taxRate: number;
}

export interface ReconEntry {
  id: string;
  date: string;
  rawSpend: number;
  impulseSpend: number;
  taxAmount: number;
  surplus: number;
  action: 'roll' | 'stash';
  impulseId?: string;
  tier: string;
  tierMultiplier: number;
  tierLimit: number;
}

export interface BillQueueItem {
  id: string;
  name: string;
  amount: number;
  // Day of month the bill is due (1-31). Optional for back-compat with legacy bills.
  dueDay?: number;
  // Paused bills stay in the template but don't appear in the queue or reserve cash.
  paused?: boolean;
}

export interface IouEntry {
  id: string;
  memberName: string;
  memberId: string;
  amount: number;
  splitId: string;
  date: string;
}

export interface IncomeEntry {
  id: string;
  date: string;  // YYYY-MM-DD
  amount: number; // monthly take-home at that point
  label: string;  // "New job", "Promotion", etc.
}

export interface AppState {
  // Auth
  userId: string | null;
  dataLoaded: boolean;
  allTransactionsLoaded: boolean;

  isConfigured: boolean;
  monthlyTakeHome: number;
  fixedBills: number;
  monthlySavingsGoal: number;
  transactions: Transaction[];
  subscriptions: Subscription[];
  vaults: Vault[];
  deletedVaults: Vault[];
  debts: Debt[];
  salary: {
    current: number;
    target: number;
  };
  stats: {
    level: number;
    experience: number;
    flipsExecuted: number;
    subscriptionsCancelled: number;
    lifetimeCapture: number;
  };
  extraCashPool: number;
  dashboardWidgets: { id: string; visible: boolean }[];
  impulses: Impulse[];
  reconHistory: ReconEntry[];
  rolloverPool: number;
  themeColors?: {
    primary?: string;
    secondary?: string;
  };
  firstName: string;
  privacyMode: boolean;
  currency: string;
  theme: 'light' | 'dark';
  squad: SquadMember[];
  splitHistory: SplitTransaction[];
  customSplitPresets: CustomSplitPreset[];
  hasCompletedOnboarding: boolean;

  // CFO Store additions
  liquidAssets: number;
  fixedBurn: number;
  safeSpendLimit: number;
  primaryVaultBalance: number;

  // Horizon Math fields
  nextPayday: string;
  upcomingBills: number;
  hardDailyCap: number;
  lastSweepDate: string;
  billQueue: BillQueueItem[];          // derived: recurringBills − paidBillKeys (cached in state for consumers)
  recurringBills: BillQueueItem[];     // the bill template (what bills exist)
  paidBillKeys: string[];              // bills paid this cycle, by name+amount key — source of truth
  iouLedger: IouEntry[];

  // Security
  isLocked: boolean;
  lockEnabled: boolean;
  // PBKDF2-derived hash of the user's PIN + the per-user salt. Empty strings
  // mean the user hasn't configured a PIN yet. The raw PIN is never stored.
  pinHash: string;
  pinSalt: string;

  // FIRE config (persisted)
  fireConfig: {
    strategy: string;
    currentAge: string;
    targetAge: string;
    annualExpenses: string;
    partTimeIncome: string;
    lockedAt: string;
  } | null;

  // Income history (persisted)
  incomeHistory: IncomeEntry[];

  // Transient UI (not persisted)
  paydayBanner: { amount: number } | null;
}

const calculatePrimaryVaultBalance = (vaults: Vault[]): number =>
  vaults.reduce((acc, vault) => acc + (vault.current || 0), 0);

// ── Bill queue: derived, never independently stored ─────────────────────────
// A bill's identity within a cycle = name + amount. Stable across template edits
// and across devices, so it's the key we use to track which bills are paid.
export const billKey = (b: { name: string; amount: number }): string =>
  `${b.name.trim().toLowerCase()}:${(b.amount || 0).toFixed(2)}`;

// The live bill queue is DERIVED from (recurring template − paid-this-cycle keys),
// never stored as its own source of truth. This makes paid state bulletproof:
// editing the template, refreshing, or signing in on another device always
// recomputes the same queue — no heuristic reconciliation, no localStorage races.
// `paidBillKeys` is the single source of truth and is persisted to Supabase.
export const deriveBillQueue = (
  recurringBills: BillQueueItem[],
  paidBillKeys: string[],
): BillQueueItem[] => {
  const paid = new Set(paidBillKeys || []);
  // Exclude paused bills (snoozed in settings) and already-paid bills.
  return (recurringBills || []).filter(b => !b.paused && !paid.has(billKey(b)));
};

export const INITIAL_STATE: AppState = {
  userId: null,
  dataLoaded: false,
  allTransactionsLoaded: false,

  isConfigured: false,
  monthlyTakeHome: 0,
  fixedBills: 0,
  monthlySavingsGoal: 0,
  transactions: [],
  subscriptions: [],
  vaults: [],
  deletedVaults: [],
  debts: [],
  salary: {
    current: 0,
    target: 0,
  },
  stats: {
    level: 1,
    experience: 0,
    flipsExecuted: 0,
    subscriptionsCancelled: 0,
    lifetimeCapture: 0,
  },
  extraCashPool: 0,
  dashboardWidgets: [
    { id: 'safe-spend', visible: true },
    { id: 'vault-status', visible: true },
    { id: 'alert', visible: true },
  ],
  impulses: [],
  reconHistory: [],
  rolloverPool: 0,
  firstName: '',
  privacyMode: false,
  currency: 'USD',
  theme: 'light',
  squad: [
    { id: '1', name: 'Alex', isActive: true },
    { id: '2', name: 'Sarah', isActive: true },
    { id: '3', name: 'Mike', isActive: false },
    { id: '4', name: 'Emma', isActive: false },
  ],
  splitHistory: [],
  customSplitPresets: [
    { id: 'preset-1', name: 'WEEKLY_DINNER', participantIds: ['1', '2'] }
  ],
  hasCompletedOnboarding: false,

  liquidAssets: 0,
  fixedBurn: 0,
  safeSpendLimit: 0,
  primaryVaultBalance: 0,

  nextPayday: '',
  upcomingBills: 0,
  hardDailyCap: 0,
  lastSweepDate: '',
  billQueue: [],
  recurringBills: [],
  paidBillKeys: [],
  iouLedger: [],

  isLocked: false,
  lockEnabled: false,
  pinHash: '',
  pinSalt: '',

  fireConfig: null,
  incomeHistory: [],

  paydayBanner: null,
};

interface StoreActions {
  setPrivacyMode: (mode: boolean) => void;
  togglePrivacyMode: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setThemeColors: (primary: string, capture: string) => Promise<void>;
  setCurrency: (code: string) => Promise<void>;
  updateDashboardWidgets: (widgets: { id: string; visible: boolean }[]) => void;
  setState: (state: Partial<AppState>) => void;
  updateState: (fn: (prev: AppState) => AppState) => void;

  // Data sync
  fetchUserData: (userId: string) => Promise<void>;
  fetchMoreTransactions: () => Promise<number>; // returns count fetched, 0 = end of history

  // CFO Actions
  setHorizon: (capital: number, nextPayday: string, upcomingBills: number, newHardDailyCap?: number, newBillQueue?: BillQueueItem[]) => void;
  payBillFromQueue: (id: string) => void;
  collectIou: (id: string) => void;
  appendIouEntries: (entries: IouEntry[]) => void;
  setBaseline: (liquid: number, fixed: number, goal: number) => void;
  executeImpulseHit: (amount: number, taxRate: number) => void;
  logSpend: (amount: number, merchant?: string, category?: string) => void;
  addSplitTransaction: (split: SplitTransaction) => void;
  saveSplitPreset: (preset: CustomSplitPreset) => void;
  deleteSplitPreset: (id: string) => void;
  addSquadMember: (name: string) => void;
  updateSquadMember: (id: string, name: string) => void;
  removeSquadMember: (id: string) => void;
  addIncome: (amount: number, source: string) => void;
  massImportTransactions: (txs: Transaction[]) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Pick<Transaction, 'category' | 'merchant' | 'amount'>>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addDebt: (debt: Omit<Debt, 'id'>) => void;
  updateDebt: (id: string, updates: Partial<Omit<Debt, 'id'>>) => void;
  removeDebt: (id: string) => void;
  makeDebtPayment: (debtId: string, extraAmount: number) => void;
  addSubscription: (name: string, amount: number) => Promise<void>;
  setSubscriptionUsage: (id: string, usage: Subscription['usage']) => Promise<void>;
  cancelSubscription: (id: string) => Promise<void>;
  updateBaseline: (income: number, savingsGoal: number) => void;
  saveFireConfig: (config: NonNullable<AppState['fireConfig']>) => Promise<void>;
  clearFireConfig: () => Promise<void>;
  addIncomeEntry: (amount: number, label: string, date: string) => Promise<void>;
  removeIncomeEntry: (id: string) => Promise<void>;
  addVault: (name: string, target: number, asset_class: VaultAssetClass) => Promise<void>;
  addFundsToVault: (vaultId: string, amount: number) => Promise<void>;
  transferVaultFunds: (sourceId: string, destinationId: string, amount: number) => Promise<void>;
  renameVault: (id: string, name: string) => void;
  deleteVault: (id: string) => void;
  restoreVault: (id: string) => void;
  permanentlyDeleteVault: (id: string) => void;
  processPayday: () => Promise<void>;
  dismissPaydayBanner: () => void;
  setImpulses: (impulses: Impulse[]) => Promise<void>;
  submitReconEntry: (params: {
    rawSpend: number;
    action: 'roll' | 'stash';
    impulseId: string | null;
    impulseSpend: number;
    taxAmount: number;
    surplus: number;
    tierId: SpendTierId;
    tierMultiplier: number;
    tierLimit: number;
  }) => void;
}

export type StoreState = AppState & StoreActions;

export const useStore = create<StoreState>()(
  (set, get) => ({
    ...INITIAL_STATE,

    // ── Sync ─────────────────────────────────────────────────────────────────

    fetchUserData: async (userId) => {
      // Initial transaction load is limited to the last 60 days. That's enough for
      // the safe-spend engine (which only looks at the current pay cycle) without
      // dragging in years of history. The Transactions/Ledger page paginates older
      // rows via fetchMoreTransactions() as the user scrolls.
      const cutoffIso = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      const [profileRes, txRes, vaultRes, deletedVaultRes, debtRes, subRes, reconRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('transactions').select('*').eq('user_id', userId).gte('date', cutoffIso).order('date', { ascending: false }),
        supabase.from('vaults').select('*').eq('user_id', userId).eq('deleted', false),
        supabase.from('vaults').select('*').eq('user_id', userId).eq('deleted', true),
        supabase.from('debts').select('*').eq('user_id', userId),
        supabase.from('subscriptions').select('*').eq('user_id', userId),
        supabase.from('recon_history').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(90),
      ]);

      const profile = profileRes.data as Record<string, unknown> | null;

      const transactions: Transaction[] = ((txRes.data ?? []) as Record<string, unknown>[]).map(t => ({
        id:         String(t.id),
        merchant:   String(t.merchant ?? 'GENERAL'),
        amount:     Number(t.amount),
        category:   String(t.category ?? 'OTHER'),
        date:       String(t.date),
        isFlip:     Boolean(t.is_flip),
        flipAmount: Number(t.flip_amount ?? 0),
      }));

      const mapVault = (v: Record<string, unknown>): Vault => ({
        id:          String(v.id),
        name:        String(v.name),
        target:      Number(v.target ?? 0),
        current:     Number(v.current ?? 0),
        asset_class: (v.asset_class as VaultAssetClass) ?? 'SINKING_FUND',
      });

      const vaults: Vault[]        = ((vaultRes.data        ?? []) as Record<string, unknown>[]).map(mapVault);
      const deletedVaults: Vault[] = ((deletedVaultRes.data ?? []) as Record<string, unknown>[]).map(mapVault);

      const debts: Debt[] = ((debtRes.data ?? []) as Record<string, unknown>[]).map(d => ({
        id:           String(d.id),
        name:         String(d.name),
        balance:      Number(d.balance ?? 0),
        interestRate: Number(d.interest_rate ?? 0),
        minPayment:   Number(d.min_payment ?? 0),
      }));

      const subscriptions: Subscription[] = ((subRes.data ?? []) as Record<string, unknown>[]).map(s => ({
        id:           String(s.id),
        name:         String(s.name),
        amount:       Number(s.amount ?? 0),
        usage:        (s.usage as 'Active' | 'Low Use' | 'Idle') ?? 'Active',
        billingCycle: (s.billing_cycle as 'Monthly' | 'Yearly') ?? 'Monthly',
      }));

      const reconHistory: ReconEntry[] = ((reconRes.data ?? []) as Record<string, unknown>[]).map(r => ({
        id:             String(r.id),
        date:           String(r.date),
        rawSpend:       Number(r.raw_spend ?? 0),
        impulseSpend:   Number(r.impulse_spend ?? 0),
        taxAmount:      Number(r.tax_amount ?? 0),
        surplus:        Number(r.surplus ?? 0),
        action:         (r.action as 'roll' | 'stash') ?? 'roll',
        impulseId:      r.impulse_id ? String(r.impulse_id) : undefined,
        tier:           String(r.tier ?? 'TIGHT'),
        tierMultiplier: Number(r.tier_multiplier ?? 0.75),
        tierLimit:      Number(r.tier_limit ?? 0),
      }));

      set((state: any) => {
        const merged: Partial<AppState> = {
          userId,
          dataLoaded: true,
          // Initial load only pulled the last 60 days. The Ledger pagination will
          // unlock older history as the user scrolls. If we got 0 rows there's nothing
          // older to fetch either — flag complete to skip pointless network calls.
          allTransactionsLoaded: transactions.length === 0,
          transactions,
          vaults,
          deletedVaults,
          debts,
          subscriptions,
          reconHistory,
          primaryVaultBalance: calculatePrimaryVaultBalance(vaults),
        };

        if (profile) {
          const widgets = profile.dashboard_widgets;
          const rawBills = profile.recurring_bills;
          const rawPaidKeys = profile.paid_bill_keys;
          const rawImpulses = profile.impulses;
          Object.assign(merged, {
            liquidAssets:          Number(profile.liquid_assets ?? 0),
            fixedBurn:             Number(profile.fixed_burn ?? 0),
            monthlyTakeHome:       Number(profile.monthly_take_home ?? 0),
            fixedBills:            Number(profile.fixed_bills ?? 0),
            monthlySavingsGoal:    Number(profile.monthly_savings_goal ?? 0),
            nextPayday:            String(profile.next_payday ?? ''),
            upcomingBills:         Number(profile.upcoming_bills ?? 0),
            hardDailyCap:          Number(profile.hard_daily_cap ?? 0),
            lastSweepDate:         String(profile.last_sweep_date ?? ''),
            extraCashPool:         Number(profile.extra_cash_pool ?? 0),
            rolloverPool:          Number(profile.rollover_pool ?? 0),
            recurringBills:        Array.isArray(rawBills) ? rawBills as BillQueueItem[] : [],
            paidBillKeys:          Array.isArray(rawPaidKeys) ? rawPaidKeys as string[] : [],
            impulses:              Array.isArray(rawImpulses) ? rawImpulses as Impulse[] : [],
            salary: {
              current: Number(profile.salary_current ?? 0),
              target:  Number(profile.salary_target ?? 0),
            },
            stats: {
              level:                  Number(profile.stat_level ?? 1),
              experience:             Number(profile.stat_experience ?? 0),
              flipsExecuted:          Number(profile.stat_flips_executed ?? 0),
              subscriptionsCancelled: Number(profile.stat_subscriptions_cancelled ?? 0),
              lifetimeCapture:        Number(profile.stat_lifetime_capture ?? 0),
            },
            firstName:             String(profile.first_name ?? ''),
            theme:                 (profile.theme as 'light' | 'dark') ?? 'light',
            privacyMode:           Boolean(profile.privacy_mode),
            currency:              String(profile.currency ?? 'USD'),
            hasCompletedOnboarding: Boolean(profile.has_completed_onboarding),
            isConfigured:          Boolean(profile.is_configured),
            fireConfig:            profile.fire_config ? (profile.fire_config as AppState['fireConfig']) : null,
            incomeHistory:         Array.isArray(profile.income_history) ? (profile.income_history as IncomeEntry[]) : [],
            dashboardWidgets:      Array.isArray(widgets) ? widgets : state.dashboardWidgets,
            ...(profile.theme_primary_color || profile.theme_capture_color ? {
              themeColors: {
                primary:   profile.theme_primary_color ? String(profile.theme_primary_color) : undefined,
                secondary: profile.theme_capture_color ? String(profile.theme_capture_color) : undefined,
              },
            } : {}),
          });
          // Keep the formatter's active currency in sync with the loaded profile.
          setActiveCurrency(String(profile.currency ?? 'USD'));
        } else {
          merged.userId      = userId;
          merged.dataLoaded  = true;
          merged.isConfigured = false;
        }

        const nextState = { ...state, ...merged };

        // Bill queue is DERIVED, every load, from (recurring template − paid keys).
        // Both inputs come from Supabase, so every device computes the identical queue —
        // no localStorage, no reconciliation, no resurrected paid bills.
        nextState.billQueue = deriveBillQueue(nextState.recurringBills, nextState.paidBillKeys);

        // Keep upcomingBills in lockstep with the derived queue total so safe-spend math
        // can't drift. Persist only if Supabase's stored value disagrees.
        const queueTotal = nextState.billQueue.reduce((s: number, b: BillQueueItem) => s + b.amount, 0);
        if (queueTotal !== nextState.upcomingBills) {
          nextState.upcomingBills = queueTotal;
          pushProfileUpdate(userId, { upcoming_bills: queueTotal }).catch(() => {});
        }

        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });
    },

    // Pulls the next 50 transactions older than the oldest one we have in memory.
    // Returns the count fetched (0 means we've hit the end of history).
    fetchMoreTransactions: async () => {
      const { userId, transactions, allTransactionsLoaded } = get() as StoreState;
      if (!userId || allTransactionsLoaded) return 0;

      // Find the oldest date currently in memory; if none, use "now" as the boundary.
      const oldestDate = transactions.length > 0
        ? transactions[transactions.length - 1].date
        : new Date().toISOString();

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .lt('date', oldestDate)
        .order('date', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[fetchMoreTransactions] error:', error);
        return 0;
      }
      const rows = (data ?? []) as Record<string, unknown>[];
      const older: Transaction[] = rows.map(t => ({
        id:         String(t.id),
        merchant:   String(t.merchant ?? 'GENERAL'),
        amount:     Number(t.amount),
        category:   String(t.category ?? 'OTHER'),
        date:       String(t.date),
        isFlip:     Boolean(t.is_flip),
        flipAmount: Number(t.flip_amount ?? 0),
      }));

      set((state: any) => ({
        ...state,
        transactions: [...state.transactions, ...older],
        // Got fewer than the page size → we've reached the end.
        allTransactionsLoaded: older.length < 50,
      }));

      return older.length;
    },

    // ── Local-only helpers ────────────────────────────────────────────────────

    setPrivacyMode: (mode) => set({ privacyMode: mode } as any),

    togglePrivacyMode: async () => {
      const { userId, privacyMode } = get() as StoreState;
      const newVal = !privacyMode;
      set({ privacyMode: newVal } as any);
      if (!userId) return;
      await (supabase.from('profiles') as any).update({ privacy_mode: newVal }).eq('id', userId);
    },

    setTheme: async (theme) => {
      const { userId } = get() as StoreState;
      set({ theme } as any);
      if (!userId) return;
      await (supabase.from('profiles') as any).update({ theme }).eq('id', userId);
    },

    setThemeColors: async (primary, capture) => {
      const { userId } = get() as StoreState;
      set((state: any) => ({ ...state, themeColors: { primary, secondary: capture } }));
      document.documentElement.style.setProperty('--color-action-primary', primary);
      document.documentElement.style.setProperty('--color-action-capture', capture);
      if (!userId) return;
      await (supabase.from('profiles') as any).update({
        theme_primary_color: primary,
        theme_capture_color: capture,
      }).eq('id', userId);
    },

    setCurrency: async (code) => {
      const { userId } = get() as StoreState;
      setActiveCurrency(code);
      set((state: any) => ({ ...state, currency: code }));
      if (!userId) return;
      try {
        const { error } = await (supabase.from('profiles') as any).update({ currency: code }).eq('id', userId);
        if (error) console.error('[setCurrency] update failed:', error);
      } catch (err) {
        console.error('[setCurrency] threw:', err);
      }
    },

    updateDashboardWidgets: async (widgets) => {
      const { userId } = get() as StoreState;
      set({ dashboardWidgets: widgets } as any);
      if (!userId) return;
      await (supabase.from('profiles') as any).update({ dashboard_widgets: widgets }).eq('id', userId);
    },
    setImpulses: async (impulses) => {
      const { userId } = get() as StoreState;
      set((state: any) => ({ ...state, impulses }));
      if (!userId) return;
      await (supabase.from('profiles') as any).update({ impulses }).eq('id', userId);
    },

    setState: (newState) => set((state: any) => {
      const nextState = { ...state, ...newState };
      return {
        ...nextState,
        primaryVaultBalance: calculatePrimaryVaultBalance(nextState.vaults),
        safeSpendLimit: calculateTrueSafeSpend(nextState),
      } as any;
    }),
    updateState: (fn) => set((state: any) => {
      const next = fn(state as AppState);
      return {
        ...next,
        primaryVaultBalance: calculatePrimaryVaultBalance(next.vaults),
        safeSpendLimit: calculateTrueSafeSpend(next),
      } as any;
    }),

    // ── Horizon ──────────────────────────────────────────────────────────────

    setHorizon: async (capital, nextPayday, _upcomingBills, newHardDailyCap, newBillQueue) => {
      const {
        userId, hardDailyCap, recurringBills, vaults: currentVaults, lastSweepDate,
        nextPayday: currentNextPayday, paidBillKeys: currentPaidKeys, upcomingBills: currentUpcomingBills,
      } = get() as StoreState;
      if (!userId) return;

      const capToUse      = newHardDailyCap !== undefined ? newHardDailyCap : (hardDailyCap ?? 0);
      const recurringToUse: BillQueueItem[] = newBillQueue !== undefined ? newBillQueue : (recurringBills || []);
      // Paused bills are snoozed: they don't count toward fixed bills or reserved cash.
      const billsTotal    = recurringToUse.filter(b => !b.paused).reduce((s, b) => s + b.amount, 0);

      // Normalize to YYYY-MM-DD so a stored timestamp ("2026-06-30T00:00:00Z") and a
      // date-input value ("2026-06-30") don't read as a changed payday.
      const dayOnly  = (s: string) => (s || '').slice(0, 10);
      const isNewCycle = dayOnly(nextPayday) !== dayOnly(currentNextPayday);

      // Paid state is the single source of truth. A new pay cycle clears it (every
      // bill is due again); otherwise keep it, pruning keys for bills no longer in
      // the template. The queue is then DERIVED from (template − paid keys), so paid
      // bills can never be resurrected by editing the template or re-saving the cycle.
      const nextPaidKeys = isNewCycle
        ? []
        : (currentPaidKeys || []).filter(k => recurringToUse.some(b => billKey(b) === k));
      const freshQueue = deriveBillQueue(recurringToUse, nextPaidKeys);

      const effectiveUpcomingBills = newBillQueue !== undefined
        ? freshQueue.reduce((s, b) => s + b.amount, 0)
        : currentUpcomingBills;

      const calcState = {
        ...(get() as StoreState),
        liquidAssets: capital,
        nextPayday,
        upcomingBills: effectiveUpcomingBills,
        fixedBills: billsTotal,
        fixedBurn: billsTotal,
        recurringBills: recurringToUse,
        paidBillKeys: nextPaidKeys,
        billQueue: freshQueue,
        isConfigured: true,
        hasCompletedOnboarding: true,
        hardDailyCap: capToUse,
      };

      const rawLimit    = calculateRawSafeSpend(calcState);
      const sweepAmount = capToUse > 0 && rawLimit > capToUse ? rawLimit - capToUse : 0;
      const todayKey    = toLocalDateKey(new Date());
      const alreadySwept = lastSweepDate === todayKey;
      const doSweep     = sweepAmount > 0 && !alreadySwept && currentVaults.length > 0;
      const firstVault  = currentVaults[0];
      const finalLiquid = doSweep ? capital - sweepAmount : capital;

      // Claim the sweep date immediately before any awaits. A concurrent call to
      // setHorizon (e.g. user double-submits) would then read lastSweepDate === todayKey
      // and skip, preventing duplicate SURPLUS INTERCEPTED transactions.
      if (doSweep) set((s: any) => ({ ...s, lastSweepDate: todayKey }));

      // Optimistic local update — happens before any awaits so the UI never loses state
      set((state: any) => {
        const baseNext = {
          ...state,
          liquidAssets:          finalLiquid,
          nextPayday,
          upcomingBills:         effectiveUpcomingBills,
          fixedBills:            billsTotal,
          fixedBurn:             billsTotal,
          recurringBills:        recurringToUse,
          paidBillKeys:          nextPaidKeys,
          billQueue:             freshQueue,
          isConfigured:          true,
          hasCompletedOnboarding: true,
          hardDailyCap:          capToUse,
        };
        return { ...baseNext, safeSpendLimit: calculateTrueSafeSpend(baseNext) };
      });

      // Core profile upsert
      const { error: profileError } = await (supabase.from('profiles') as any).upsert({
        id:                      userId,
        liquid_assets:           finalLiquid,
        next_payday:             nextPayday || null,
        upcoming_bills:          effectiveUpcomingBills,
        fixed_bills:             billsTotal,
        fixed_burn:              billsTotal,
        hard_daily_cap:          capToUse,
        is_configured:           true,
        has_completed_onboarding: true,
        last_sweep_date:         doSweep ? todayKey : (lastSweepDate || null),
        recurring_bills:         recurringToUse,
        paid_bill_keys:          nextPaidKeys,
      }, { onConflict: 'id' });
      if (profileError) {
        console.error('[setHorizon] profile upsert failed:', profileError);
        return;
      }

      // Sweep transaction + vault update
      const sweepTxId = doSweep ? crypto.randomUUID() : null;
      if (doSweep && firstVault && sweepTxId) {
        const [txRes, vaultRes] = await Promise.all([
          (supabase.from('transactions') as any).insert({
            id:          sweepTxId,
            user_id:     userId,
            merchant:    'SURPLUS INTERCEPTED',
            amount:      sweepAmount,
            category:    'SAVINGS',
            is_flip:     false,
            flip_amount: 0,
            date:        new Date().toISOString(),
          }),
          (supabase.from('vaults') as any).update({ current: firstVault.current + sweepAmount }).eq('id', firstVault.id),
        ]);
        if (txRes.error || vaultRes.error) return;

        // Update local state with sweep side-effects
        set((state: any) => {
          const nextVaults = state.vaults.map((v: any) =>
            v.id === firstVault.id ? { ...v, current: v.current + sweepAmount } : v
          );
          const baseNext = {
            ...state,
            lastSweepDate: todayKey,
            vaults:              nextVaults,
            primaryVaultBalance: calculatePrimaryVaultBalance(nextVaults),
            transactions: [{
              id:        sweepTxId,
              merchant:  'SURPLUS INTERCEPTED',
              amount:    sweepAmount,
              category:  'SAVINGS',
              date:      new Date().toISOString(),
              isFlip:    false,
              flipAmount: 0,
            }, ...state.transactions],
            stats: {
              ...state.stats,
              lifetimeCapture: (state.stats?.lifetimeCapture || 0) + sweepAmount,
            },
          };
          return { ...baseNext, safeSpendLimit: calculateTrueSafeSpend(baseNext) };
        });
      }
    },

    setBaseline: async (liquid, fixed, goal) => {
      const { userId } = get() as StoreState;
      if (!userId) return;

      const { error } = await (supabase.from('profiles') as any).update({
        liquid_assets:      liquid,
        fixed_burn:         fixed,
        monthly_savings_goal: goal,
        is_configured:      true,
      }).eq('id', userId);
      if (error) return;

      set((state: any) => {
        const nextState = {
          ...state,
          liquidAssets:      liquid,
          fixedBurn:         fixed,
          monthlySavingsGoal: goal,
          primaryVaultBalance: calculatePrimaryVaultBalance(state.vaults),
          isConfigured:      true,
        };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });
    },

    // ── Spending ─────────────────────────────────────────────────────────────

    logSpend: async (amount, merchant, category) => {
      const { userId, safeSpendLimit, vaults, liquidAssets } = get() as StoreState;
      if (!userId) return;

      const isOverspend = amount > safeSpendLimit;
      const penalty     = isOverspend ? amount * UNIVERSAL_FLIP_RATE : 0;
      const now         = new Date().toISOString();
      const mainTxId    = crypto.randomUUID();
      const penaltyTxId = isOverspend && penalty > 0 ? crypto.randomUUID() : null;
      const firstVault  = vaults[0] ?? null;

      const inserts: Record<string, unknown>[] = [{
        id:          mainTxId,
        user_id:     userId,
        merchant:    merchant?.trim().toUpperCase() || 'GENERAL',
        amount,
        category:    category || 'OTHER',
        is_flip:     isOverspend,
        flip_amount: penalty,
        date:        now,
      }];
      if (penaltyTxId) {
        inserts.push({
          id:          penaltyTxId,
          user_id:     userId,
          merchant:    'OVERSPEND PENALTY',
          amount:      penalty,
          category:    'SAVINGS',
          is_flip:     true,
          flip_amount: 0,
          date:        now,
        });
      }

      // Optimistic local update — UI reacts instantly
      set((state: any) => {
        const nextVaults = (penalty > 0 && firstVault)
          ? state.vaults.map((v: any) => v.id === firstVault.id ? { ...v, current: v.current + penalty } : v)
          : state.vaults;

        const newTxs: Transaction[] = [{
          id:        mainTxId,
          merchant:  merchant?.trim().toUpperCase() || 'GENERAL',
          amount,
          category:  category || 'OTHER',
          date:      now,
          isFlip:    isOverspend,
          flipAmount: penalty,
        }];
        if (penaltyTxId) {
          newTxs.push({
            id:        penaltyTxId,
            merchant:  'OVERSPEND PENALTY',
            amount:    penalty,
            category:  'SAVINGS',
            date:      now,
            isFlip:    true,
            flipAmount: 0,
          });
        }

        const nextState = {
          ...state,
          liquidAssets:        state.liquidAssets - amount - penalty,
          primaryVaultBalance: calculatePrimaryVaultBalance(nextVaults),
          vaults:              nextVaults,
          transactions:        [...newTxs, ...state.transactions],
          stats: {
            ...state.stats,
            flipsExecuted:   state.stats.flipsExecuted + (isOverspend ? 1 : 0),
            lifetimeCapture: state.stats.lifetimeCapture + penalty,
          },
        };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });

      // Fire-and-forget sync — background, never blocks UI
      pushTransactions(inserts).catch(() => {});
      pushProfileUpdate(userId, { liquid_assets: liquidAssets - amount - penalty }).catch(() => {});
      if (penalty > 0 && firstVault) {
        pushVaultUpdate(firstVault.id, { current: firstVault.current + penalty }).catch(() => {});
      }
    },

    executeImpulseHit: async (amount, taxRate) => {
      const { userId, vaults } = get() as StoreState;
      if (!userId) return;

      const penalty    = amount * taxRate;
      const now        = new Date().toISOString();
      const mainTxId   = crypto.randomUUID();
      const captureTxId = penalty > 0 ? crypto.randomUUID() : null;
      const firstVault  = vaults[0] ?? null;

      const inserts: Record<string, unknown>[] = [{
        id:          mainTxId,
        user_id:     userId,
        merchant:    'IMPULSE_HIT',
        amount,
        category:    'PENALTY',
        is_flip:     true,
        flip_amount: penalty,
        date:        now,
      }];
      if (captureTxId && penalty > 0) {
        inserts.push({
          id:          captureTxId,
          user_id:     userId,
          merchant:    'IMPULSE TAX',
          amount:      penalty,
          category:    'SAVINGS',
          is_flip:     true,
          flip_amount: 0,
          date:        now,
        });
      }

      const { error } = await supabase.from('transactions').insert(inserts as any);
      if (error) return;

      if (penalty > 0 && firstVault) {
        await (supabase.from('vaults') as any).update({ current: firstVault.current + penalty }).eq('id', firstVault.id);
      }

      set((state: any) => {
        const nextVaults = (penalty > 0 && firstVault)
          ? state.vaults.map((v: any) => v.id === firstVault.id ? { ...v, current: v.current + penalty } : v)
          : state.vaults;

        const newTxs: Transaction[] = [{
          id:        mainTxId,
          merchant:  'IMPULSE_HIT',
          amount,
          category:  'PENALTY',
          date:      now,
          isFlip:    true,
          flipAmount: penalty,
        }];
        if (captureTxId) {
          newTxs.push({
            id:        captureTxId,
            merchant:  'IMPULSE TAX',
            amount:    penalty,
            category:  'SAVINGS',
            date:      now,
            isFlip:    true,
            flipAmount: 0,
          });
        }

        const nextState = {
          ...state,
          liquidAssets:        state.liquidAssets - amount - penalty,
          primaryVaultBalance: calculatePrimaryVaultBalance(nextVaults),
          vaults:              nextVaults,
          transactions:        [...newTxs, ...state.transactions],
          stats: {
            ...state.stats,
            flipsExecuted:   state.stats.flipsExecuted + (penalty > 0 ? 1 : 0),
            lifetimeCapture: state.stats.lifetimeCapture + penalty,
          },
        };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });
    },

    addIncome: async (amount, source) => {
      const { userId } = get() as StoreState;
      if (!userId) return;

      const txId      = crypto.randomUUID();
      const now       = new Date().toISOString();
      const merchant  = source.trim().toUpperCase() || 'EXTRA INCOME';

      const tx: Transaction = {
        id:        txId,
        merchant,
        amount,
        category:  'INCOME',
        date:      now,
        isFlip:    false,
        flipAmount: 0,
      };

      // Optimistic local update — UI reacts instantly
      set((state: any) => {
        const nextState = {
          ...state,
          liquidAssets: state.liquidAssets + amount,
          transactions: [tx, ...state.transactions],
        };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });

      // Fire-and-forget sync — background, never blocks UI
      pushTransactions([{
        id:          txId,
        user_id:     userId,
        merchant,
        amount,
        category:    'INCOME',
        is_flip:     false,
        flip_amount: 0,
        date:        now,
      }]).catch(() => {});
    },

    massImportTransactions: async (txs) => {
      if (!txs || txs.length === 0) return;
      const { userId } = get() as StoreState;

      // Local optimistic update — new imports get prepended, balance stays untouched.
      // (Imports represent past history, not new money movement, so we don't touch liquidAssets.)
      set((state: any) => {
        const merged = [...txs, ...state.transactions];
        return { ...state, transactions: merged };
      });

      if (!userId) return;
      // Push to Supabase in one batch (papaparse can deliver thousands at once).
      const rows = txs.map(t => ({
        id:          t.id,
        user_id:     userId,
        merchant:    t.merchant,
        amount:      t.amount,
        category:    t.category,
        is_flip:     t.isFlip,
        flip_amount: t.flipAmount,
        date:        t.date,
      }));
      try {
        const { error } = await (supabase.from('transactions') as any).insert(rows);
        if (error) console.error('[massImportTransactions] insert failed:', error);
      } catch (err) {
        console.error('[massImportTransactions] threw:', err);
      }
    },

    updateTransaction: async (id, updates) => {
      const { userId } = get() as StoreState;
      set((state: any) => ({
        ...state,
        transactions: state.transactions.map((t: Transaction) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      }));
      if (userId) {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.category !== undefined) dbUpdates.category = updates.category;
        if (updates.merchant  !== undefined) dbUpdates.merchant  = updates.merchant;
        if (updates.amount    !== undefined) dbUpdates.amount    = updates.amount;
        try {
          const { error } = await (supabase.from('transactions') as any).update(dbUpdates).eq('id', id);
          if (error) console.error('[updateTransaction] failed:', error);
        } catch (err) {
          console.error('[updateTransaction] threw:', err);
        }
      }
    },

    // Removes a transaction record and reverses its impact on liquidAssets. Deleting a
    // BILL_PAYMENT also UN-pays the bill — it returns to the queue and is re-reserved,
    // so the refunded cash doesn't silently become free spend. Vault/debt side-effects
    // are still not unwound (owned by their own actions).
    deleteTransaction: async (id) => {
      const { userId, transactions, recurringBills, paidBillKeys } = get() as StoreState;
      const tx = transactions.find(t => t.id === id);
      if (!tx) return;

      // Cash flow reversal: incomes added cash, everything else removed it.
      const isIncome = tx.category === 'INCOME' || tx.category === 'VAULT_WITHDRAWAL';
      const liquidDelta = isIncome ? -tx.amount : tx.amount;

      // If it's a bill payment, un-pay that bill (strip its key) so it reappears unpaid.
      const isBillPayment = tx.category === 'BILL_PAYMENT';
      const billName = isBillPayment ? tx.merchant.replace(/^BILL:\s*/i, '') : '';
      const payKey   = isBillPayment ? billKey({ name: billName, amount: tx.amount }) : '';
      const unpays   = isBillPayment && (paidBillKeys || []).includes(payKey);
      const nextPaidKeys = unpays ? (paidBillKeys || []).filter(k => k !== payKey) : paidBillKeys;
      const nextQueue    = unpays ? deriveBillQueue(recurringBills, nextPaidKeys) : null;

      set((state: any) => {
        const nextState: any = {
          ...state,
          transactions: state.transactions.filter((t: Transaction) => t.id !== id),
          liquidAssets: state.liquidAssets + liquidDelta,
        };
        if (unpays && nextQueue) {
          nextState.paidBillKeys  = nextPaidKeys;
          nextState.billQueue     = nextQueue;
          nextState.upcomingBills = nextQueue.reduce((s: number, b: BillQueueItem) => s + b.amount, 0);
        }
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });

      if (userId) {
        const s = get() as StoreState;
        const updates: Record<string, unknown> = { liquid_assets: s.liquidAssets };
        if (unpays) { updates.paid_bill_keys = s.paidBillKeys; updates.upcoming_bills = s.upcomingBills; }
        pushProfileUpdate(userId, updates).catch(() => {});
        try {
          const { error } = await supabase.from('transactions').delete().eq('id', id);
          if (error) console.error('[deleteTransaction] delete failed:', error);
        } catch (err) {
          console.error('[deleteTransaction] threw:', err);
        }
      }
    },

    // ── Split ─────────────────────────────────────────────────────────────────

    addSplitTransaction: async (split) => {
      const { userId, vaults } = get() as StoreState;
      if (!userId) return;

      const now         = split.timestamp;
      const firstVault  = vaults[0] ?? null;
      const captureId   = split.personalFlipCaptured > 0 ? split.id + '_capture' : null;

      const inserts: Record<string, unknown>[] = [{
        id:          split.id,
        user_id:     userId,
        merchant:    'SPLIT: ' + split.presetUsed,
        amount:      split.personalDeduction,
        category:    'SOCIAL',
        is_flip:     split.personalFlipCaptured > 0,
        flip_amount: split.personalFlipCaptured,
        date:        now,
      }];
      if (captureId) {
        inserts.push({
          id:          captureId,
          user_id:     userId,
          merchant:    'SPLIT CAPTURE',
          amount:      split.personalFlipCaptured,
          category:    'SAVINGS',
          is_flip:     true,
          flip_amount: 0,
          date:        now,
        });
      }

      const { error } = await supabase.from('transactions').insert(inserts as any);
      if (error) return;

      if (split.personalFlipCaptured > 0 && firstVault) {
        await (supabase.from('vaults') as any).update({
          current: firstVault.current + split.personalFlipCaptured,
        }).eq('id', firstVault.id);
      }

      set((state: any) => {
        const nextVaults = (split.personalFlipCaptured > 0 && firstVault)
          ? state.vaults.map((v: any) => v.id === firstVault.id ? { ...v, current: v.current + split.personalFlipCaptured } : v)
          : state.vaults;

        const spendTx: Transaction = {
          id:        split.id,
          merchant:  'SPLIT: ' + split.presetUsed,
          amount:    split.personalDeduction,
          category:  'SOCIAL',
          date:      now,
          isFlip:    split.personalFlipCaptured > 0,
          flipAmount: split.personalFlipCaptured,
        };
        const txList: Transaction[] = captureId
          ? [{ id: captureId, merchant: 'SPLIT CAPTURE', amount: split.personalFlipCaptured, category: 'SAVINGS', date: now, isFlip: true, flipAmount: 0 }, spendTx]
          : [spendTx];

        const nextState = {
          ...state,
          // You front the ENTIRE bill (others repay you via the IOU ledger), plus the
          // flip moves to your vault. Deducting only your share here let IOU collections
          // net you a profit on bills you hosted. Net after collections = your share + flip.
          liquidAssets:        state.liquidAssets - split.totalBill - split.personalFlipCaptured,
          primaryVaultBalance: calculatePrimaryVaultBalance(nextVaults),
          vaults:              nextVaults,
          splitHistory:        [split, ...state.splitHistory],
          transactions:        [...txList, ...state.transactions],
          stats: {
            ...state.stats,
            flipsExecuted:   state.stats.flipsExecuted + (split.personalFlipCaptured > 0 ? 1 : 0),
            lifetimeCapture: state.stats.lifetimeCapture + split.personalFlipCaptured,
          },
        };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });
    },

    // ── Debts ─────────────────────────────────────────────────────────────────

    addDebt: async (debt) => {
      const { userId } = get() as StoreState;
      if (!userId) return;

      const newDebt: Debt = { id: crypto.randomUUID(), ...debt };
      const { error } = await (supabase.from('debts') as any).insert({
        id:            newDebt.id,
        user_id:       userId,
        name:          newDebt.name,
        balance:       newDebt.balance,
        interest_rate: newDebt.interestRate,
        min_payment:   newDebt.minPayment,
      });
      if (error) return;

      set((state: any) => {
        const nextState = { ...state, debts: [...state.debts, newDebt] };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });
    },

    updateDebt: async (id, updates) => {
      const { userId } = get() as StoreState;
      if (!userId) return;

      const dbUpdates: Record<string, unknown> = {};
      if (updates.name          !== undefined) dbUpdates.name          = updates.name;
      if (updates.balance       !== undefined) dbUpdates.balance       = updates.balance;
      if (updates.interestRate  !== undefined) dbUpdates.interest_rate = updates.interestRate;
      if (updates.minPayment    !== undefined) dbUpdates.min_payment   = updates.minPayment;

      const { error } = await (supabase.from('debts') as any).update(dbUpdates).eq('id', id);
      if (error) return;

      set((state: any) => {
        const nextState = { ...state, debts: state.debts.map((d: Debt) => d.id === id ? { ...d, ...updates } : d) };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });
    },

    removeDebt: async (id) => {
      const { userId } = get() as StoreState;
      if (!userId) return;

      const { error } = await (supabase.from('debts') as any).delete().eq('id', id);
      if (error) return;

      set((state: any) => {
        const nextState = { ...state, debts: state.debts.filter((d: Debt) => d.id !== id) };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });
    },

    makeDebtPayment: async (debtId, extraAmount) => {
      const { userId, debts, liquidAssets } = get() as StoreState;
      if (!userId) return;

      const debt = debts.find(d => d.id === debtId);
      if (!debt || extraAmount <= 0) return;

      const txId      = crypto.randomUUID();
      const now       = new Date().toISOString();
      const newBalance = Math.max(0, debt.balance - extraAmount);

      const [txRes, debtRes] = await Promise.all([
        (supabase.from('transactions') as any).insert({
          id:          txId,
          user_id:     userId,
          merchant:    `DEBT PAYMENT: ${debt.name}`,
          amount:      extraAmount,
          category:    'DEBT_PAYMENT',
          is_flip:     false,
          flip_amount: 0,
          date:        now,
        }),
        (supabase.from('debts') as any).update({ balance: newBalance }).eq('id', debtId),
      ]);
      if (txRes.error || debtRes.error) return;

      // Suppress unused-variable warning — liquidAssets read above for context
      void liquidAssets;

      set((state: any) => {
        const paymentTx: Transaction = {
          id:        txId,
          merchant:  `DEBT PAYMENT: ${debt.name}`,
          amount:    extraAmount,
          category:  'DEBT_PAYMENT',
          date:      now,
          isFlip:    false,
          flipAmount: 0,
        };
        const nextState = {
          ...state,
          liquidAssets: state.liquidAssets - extraAmount,
          debts: state.debts.map((d: Debt) => d.id === debtId ? { ...d, balance: newBalance } : d),
          transactions: [paymentTx, ...state.transactions],
        };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });
    },

    // ── Subscriptions ───────────────────────────────────────────────────────
    // Each action persists to the Supabase `subscriptions` table so adds/edits
    // survive a refresh — the page previously only mutated local state.

    addSubscription: async (name, amount) => {
      const { userId } = get() as StoreState;
      if (!userId) return;

      const newSub: Subscription = {
        id: crypto.randomUUID(),
        name: name.trim(),
        amount,
        usage: 'Active',
        billingCycle: 'Monthly',
      };
      const { error } = await (supabase.from('subscriptions') as any).insert({
        id:            newSub.id,
        user_id:       userId,
        name:          newSub.name,
        amount:        newSub.amount,
        usage:         newSub.usage,
        billing_cycle: newSub.billingCycle,
      });
      if (error) { console.error('[addSubscription] insert failed:', error); return; }

      set((state: any) => {
        const nextState = {
          ...state,
          subscriptions: [...state.subscriptions, newSub],
          fixedBills: state.fixedBills + amount,
        };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });
      pushProfileUpdate(userId, { fixed_bills: (get() as StoreState).fixedBills }).catch(() => {});
    },

    setSubscriptionUsage: async (id, usage) => {
      const { userId } = get() as StoreState;
      set((state: any) => ({
        ...state,
        subscriptions: state.subscriptions.map((s: Subscription) => s.id === id ? { ...s, usage } : s),
      }));
      if (!userId) return;
      try {
        const { error } = await (supabase.from('subscriptions') as any).update({ usage }).eq('id', id);
        if (error) console.error('[setSubscriptionUsage] update failed:', error);
      } catch (err) {
        console.error('[setSubscriptionUsage] threw:', err);
      }
    },

    cancelSubscription: async (id) => {
      const { userId, subscriptions } = get() as StoreState;
      const sub = subscriptions.find(s => s.id === id);
      if (!sub) return;

      if (userId) {
        try {
          const { error } = await (supabase.from('subscriptions') as any).delete().eq('id', id);
          if (error) { console.error('[cancelSubscription] delete failed:', error); return; }
        } catch (err) {
          console.error('[cancelSubscription] threw:', err);
          return;
        }
      }

      set((state: any) => {
        const newExp = (state.stats?.experience || 0) + 50;
        const nextState = {
          ...state,
          subscriptions: state.subscriptions.filter((s: Subscription) => s.id !== id),
          fixedBills: Math.max(0, state.fixedBills - sub.amount),
          monthlySavingsGoal: state.monthlySavingsGoal + sub.amount,
          stats: {
            ...state.stats,
            experience: newExp,
            level: Math.floor(newExp / 1000) + 1,
            subscriptionsCancelled: (state.stats?.subscriptionsCancelled || 0) + 1,
            lifetimeCapture: (state.stats?.lifetimeCapture || 0) + sub.amount,
          },
        };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });

      if (userId) {
        const s = get() as StoreState;
        pushProfileUpdate(userId, {
          fixed_bills:                 s.fixedBills,
          monthly_savings_goal:        s.monthlySavingsGoal,
          stat_subscriptions_cancelled: s.stats.subscriptionsCancelled,
          stat_lifetime_capture:        s.stats.lifetimeCapture,
        }).catch(() => {});
      }
    },

    updateBaseline: async (income, savingsGoal) => {
      const { userId, upcomingBills } = get() as StoreState;
      if (!userId) return;

      const bills = upcomingBills ?? 0;
      const { error } = await (supabase.from('profiles') as any).update({
        monthly_take_home:    income,
        fixed_bills:          bills,
        fixed_burn:           bills,
        monthly_savings_goal: savingsGoal,
      }).eq('id', userId);
      if (error) return;

      set((state: any) => {
        const nextState = {
          ...state,
          monthlyTakeHome:    income,
          fixedBills:         bills,
          fixedBurn:          bills,
          monthlySavingsGoal: savingsGoal,
        };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });
    },

    saveFireConfig: async (config) => {
      const { userId } = get() as StoreState;
      if (!userId) return;
      set((state: any) => ({ ...state, fireConfig: config }));
      await (supabase.from('profiles') as any).update({ fire_config: config }).eq('id', userId);
    },

    clearFireConfig: async () => {
      const { userId } = get() as StoreState;
      if (!userId) return;
      set((state: any) => ({ ...state, fireConfig: null }));
      await (supabase.from('profiles') as any).update({ fire_config: null }).eq('id', userId);
    },

    addIncomeEntry: async (amount, label, date) => {
      const { userId, incomeHistory } = get() as StoreState;
      const entry: IncomeEntry = { id: crypto.randomUUID(), date, amount, label };
      const next = [...incomeHistory, entry].sort((a, b) => a.date.localeCompare(b.date));
      set((state: any) => ({ ...state, incomeHistory: next }));
      if (!userId) return;
      await (supabase.from('profiles') as any).update({ income_history: next }).eq('id', userId);
    },

    removeIncomeEntry: async (id) => {
      const { userId, incomeHistory } = get() as StoreState;
      const next = incomeHistory.filter(e => e.id !== id);
      set((state: any) => ({ ...state, incomeHistory: next }));
      if (!userId) return;
      await (supabase.from('profiles') as any).update({ income_history: next }).eq('id', userId);
    },

    // ── Vaults ────────────────────────────────────────────────────────────────

    addVault: async (name, target, asset_class) => {
      const { userId } = get() as StoreState;
      const newVault: Vault = {
        id:          crypto.randomUUID(),
        name:        name.trim(),
        target,
        current:     0,
        asset_class,
      };

      set((state: any) => {
        const nextVaults = [...state.vaults, newVault];
        return {
          vaults:              nextVaults,
          primaryVaultBalance: calculatePrimaryVaultBalance(nextVaults),
        };
      });

      // Requires: ALTER TABLE vaults ADD COLUMN asset_class TEXT DEFAULT 'SINKING_FUND';
      if (userId) {
        pushVaultInsert(userId, {
          id:          newVault.id,
          name:        newVault.name,
          target:      newVault.target,
          current:     0,
          asset_class: newVault.asset_class,
          deleted:     false,
        }).catch(() => {});
      }
    },

    addFundsToVault: async (vaultId, amount) => {
      const { userId, vaults, liquidAssets } = get() as StoreState;
      if (amount <= 0 || amount > liquidAssets) return;
      const vault = vaults.find(v => v.id === vaultId);
      if (!vault) return;

      const txId = crypto.randomUUID();
      const now  = new Date().toISOString();

      set((state: any) => {
        const nextVaults = state.vaults.map((v: any) =>
          v.id === vaultId ? { ...v, current: v.current + amount } : v
        );
        const nextState = {
          ...state,
          liquidAssets:        state.liquidAssets - amount,
          primaryVaultBalance: calculatePrimaryVaultBalance(nextVaults),
          vaults:              nextVaults,
          transactions: [{
            id:         txId,
            merchant:   `VAULT: ${vault.name}`,
            amount,
            category:   'VAULT_DEPOSIT',
            date:       now,
            isFlip:     false,
            flipAmount: 0,
          }, ...state.transactions],
        };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });

      if (userId) {
        pushVaultUpdate(vaultId, { current: vault.current + amount }).catch(() => {});
        pushProfileUpdate(userId, { liquid_assets: liquidAssets - amount }).catch(() => {});
        pushTransactions([{
          id:          txId,
          user_id:     userId,
          merchant:    `VAULT: ${vault.name}`,
          amount,
          category:    'VAULT_DEPOSIT',
          is_flip:     false,
          flip_amount: 0,
          date:        now,
        }]).catch(() => {});
      }
    },

    transferVaultFunds: async (sourceId, destinationId, amount) => {
      const { userId, vaults, liquidAssets } = get() as StoreState;
      const source = vaults.find(v => v.id === sourceId);
      if (!source || amount <= 0 || amount > source.current) return;

      const toLiquid  = destinationId === 'LIQUID';
      const destVault = toLiquid ? null : vaults.find(v => v.id === destinationId);
      if (!toLiquid && !destVault) return;

      const txId     = crypto.randomUUID();
      const now      = new Date().toISOString();
      const merchant = toLiquid
        ? `WITHDRAWAL: ${source.name}`
        : `TRANSFER: ${source.name} → ${destVault!.name}`;
      const category = toLiquid ? 'VAULT_WITHDRAWAL' : 'VAULT_TRANSFER';

      set((state: any) => {
        const nextVaults = state.vaults.map((v: Vault) => {
          if (v.id === sourceId)                   return { ...v, current: v.current - amount };
          if (!toLiquid && v.id === destinationId) return { ...v, current: v.current + amount };
          return v;
        });
        const nextState = {
          ...state,
          vaults:              nextVaults,
          liquidAssets:        toLiquid ? state.liquidAssets + amount : state.liquidAssets,
          primaryVaultBalance: calculatePrimaryVaultBalance(nextVaults),
          transactions: [{
            id: txId, merchant, amount, category,
            date: now, isFlip: false, flipAmount: 0,
          }, ...state.transactions],
        };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });

      if (userId) {
        pushVaultUpdate(sourceId, { current: source.current - amount }).catch(() => {});
        pushTransactions([{
          id: txId, user_id: userId, merchant, amount,
          category, is_flip: false, flip_amount: 0, date: now,
        }]).catch(() => {});
        if (toLiquid) {
          pushProfileUpdate(userId, { liquid_assets: liquidAssets + amount }).catch(() => {});
        } else {
          pushVaultUpdate(destinationId, { current: destVault!.current + amount }).catch(() => {});
        }
      }
    },

    renameVault: async (id, name) => {
      const { userId } = get() as StoreState;
      set((state: any) => ({
        vaults: state.vaults.map((v: Vault) => v.id === id ? { ...v, name: name.trim() } : v),
      }));
      if (userId) pushVaultUpdate(id, { name: name.trim() }).catch(() => {});
    },

    deleteVault: async (id) => {
      const { userId } = get() as StoreState;
      set((state: any) => {
        const vault = state.vaults.find((v: Vault) => v.id === id);
        if (!vault) return state;
        const nextVaults = state.vaults.filter((v: Vault) => v.id !== id);
        return {
          vaults:              nextVaults,
          primaryVaultBalance: calculatePrimaryVaultBalance(nextVaults),
          deletedVaults:       [vault, ...(state.deletedVaults || [])],
        };
      });
      if (userId) pushVaultUpdate(id, { deleted: true }).catch(() => {});
    },

    restoreVault: async (id) => {
      const { userId } = get() as StoreState;
      set((state: any) => {
        const vault = (state.deletedVaults || []).find((v: Vault) => v.id === id);
        if (!vault) return state;
        const nextVaults = [...state.vaults, vault];
        return {
          deletedVaults:       state.deletedVaults.filter((v: Vault) => v.id !== id),
          vaults:              nextVaults,
          primaryVaultBalance: calculatePrimaryVaultBalance(nextVaults),
        };
      });
      if (userId) pushVaultUpdate(id, { deleted: false }).catch(() => {});
    },

    permanentlyDeleteVault: async (id) => {
      const { userId } = get() as StoreState;
      // Remove locally first for instant feedback.
      set((state: any) => ({
        deletedVaults: (state.deletedVaults || []).filter((v: Vault) => v.id !== id),
      }));
      if (userId) {
        // Must await: supabase query builders are lazy and only fire when awaited.
        // (The old fire-and-forget call never actually deleted the row, so it
        // reappeared on the next data load.)
        const { error } = await (supabase.from('vaults') as any).delete().eq('id', id);
        if (error) console.error('[vault] permanent delete failed', error);
      }
    },

    submitReconEntry: ({ rawSpend, action, impulseId, impulseSpend, taxAmount, surplus, tierId, tierMultiplier, tierLimit }) => {
      const { userId, vaults, liquidAssets } = get() as StoreState;

      const todayKey  = toLocalDateKey(new Date());
      const timestamp = new Date().toISOString();
      const entryId   = crypto.randomUUID();

      const stashAmount     = action === 'stash' && surplus > 0 ? surplus : 0;
      const creditedToVault = stashAmount + taxAmount;
      const firstVault      = vaults[0] ?? null;

      const newEntry: ReconEntry = {
        id: entryId, date: todayKey, rawSpend, impulseSpend, taxAmount, surplus,
        action, impulseId: impulseId || undefined, tier: tierId, tierMultiplier, tierLimit,
      };

      const txInserts: Record<string, unknown>[] = [];
      const newTxs: Transaction[] = [];

      if (taxAmount > 0) {
        const taxId = crypto.randomUUID();
        const capId = crypto.randomUUID();
        txInserts.push(
          { id: taxId, merchant: 'RECON IMPULSE TAX', amount: 0, category: 'PENALTY', is_flip: true, flip_amount: taxAmount, date: timestamp },
          { id: capId, merchant: 'RECON CAPTURE', amount: taxAmount, category: 'SAVINGS', is_flip: true, flip_amount: 0, date: timestamp },
        );
        newTxs.push(
          { id: taxId, merchant: 'RECON IMPULSE TAX', amount: 0, category: 'PENALTY', date: timestamp, isFlip: true, flipAmount: taxAmount },
          { id: capId, merchant: 'RECON CAPTURE', amount: taxAmount, category: 'SAVINGS', date: timestamp, isFlip: true, flipAmount: 0 },
        );
      }

      if (stashAmount > 0) {
        const stashId = crypto.randomUUID();
        txInserts.push({ id: stashId, merchant: 'RECON STASH', amount: stashAmount, category: 'VAULT_DEPOSIT', is_flip: false, flip_amount: 0, date: timestamp });
        newTxs.push({ id: stashId, merchant: 'RECON STASH', amount: stashAmount, category: 'VAULT_DEPOSIT', date: timestamp, isFlip: false, flipAmount: 0 });
      }

      // Optimistic local update
      set((state: any) => {
        const nextVaults = state.vaults.map((v: Vault, i: number) => {
          if (i !== 0) return v;
          if (action === 'roll' && taxAmount > 0) return { ...v, current: v.current + taxAmount };
          if (action === 'stash' && creditedToVault > 0) return { ...v, current: v.current + creditedToVault };
          return v;
        });
        const newExp   = (state.stats?.experience || 0) + (action === 'roll' && surplus > 0 ? 10 : 0);
        const nextState = {
          ...state,
          liquidAssets:        state.liquidAssets - creditedToVault,
          primaryVaultBalance: calculatePrimaryVaultBalance(nextVaults),
          vaults:              nextVaults,
          transactions:        [...newTxs, ...state.transactions],
          reconHistory:        [...state.reconHistory, newEntry],
          stats: { ...state.stats, experience: newExp, level: Math.floor(newExp / 1000) + 1, lifetimeCapture: (state.stats?.lifetimeCapture || 0) + taxAmount },
        };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });

      // Fire-and-forget Supabase sync
      if (userId) {
        if (txInserts.length > 0) {
          pushTransactions(txInserts.map(t => ({ ...t, user_id: userId }))).catch(() => {});
        }
        if (creditedToVault > 0 && firstVault) {
          const newBalance = action === 'roll'
            ? firstVault.current + taxAmount
            : firstVault.current + creditedToVault;
          pushVaultUpdate(firstVault.id, { current: newBalance }).catch(() => {});
        }
        pushProfileUpdate(userId, { liquid_assets: liquidAssets - creditedToVault }).catch(() => {});
        pushReconEntry(userId, {
          id: entryId, date: todayKey,
          raw_spend: rawSpend, impulse_spend: impulseSpend, tax_amount: taxAmount,
          surplus, action, impulse_id: impulseId || null,
          tier: tierId, tier_multiplier: tierMultiplier, tier_limit: tierLimit,
        }).catch(() => {});
      }
    },

    processPayday: async () => {
      if (_paydayProcessing) return;
      _paydayProcessing = true;
      try {
        const { userId, liquidAssets, monthlyTakeHome, nextPayday, isConfigured } = get() as StoreState;
        if (!isConfigured || !nextPayday || monthlyTakeHome <= 0) return;

        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (todayKey < nextPayday) return;

        const txId = crypto.randomUUID();
        const now  = new Date().toISOString();

        // Advance by 1 calendar month (JS handles month overflow automatically)
        const [py, pm, pd] = nextPayday.split('-').map(Number);
        const nextDate = new Date(py, pm, pd); // pm is 1-based here, so this = month+1 (0-based)
        const newNextPayday = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;

        // New cycle → all bills are due again: clear paid state, re-derive the full queue.
        const { recurringBills } = get() as StoreState;
        const freshQueue = deriveBillQueue(recurringBills, []);

        if (userId) {
          await Promise.all([
            (supabase.from('profiles') as any).update({
              liquid_assets: liquidAssets + monthlyTakeHome,
              next_payday:   newNextPayday,
              paid_bill_keys: [],
            }).eq('id', userId),
            (supabase.from('transactions') as any).insert({
              id:          txId,
              user_id:     userId,
              merchant:    'PAYDAY',
              amount:      monthlyTakeHome,
              category:    'INCOME',
              is_flip:     false,
              flip_amount: 0,
              date:        now,
            }),
          ]);
        }

        set((state: any) => {
          const nextState = {
            ...state,
            liquidAssets: state.liquidAssets + state.monthlyTakeHome,
            nextPayday:   newNextPayday,
            paidBillKeys: [],
            billQueue:    freshQueue,
            transactions: [{
              id:        txId,
              merchant:  'PAYDAY',
              amount:    state.monthlyTakeHome,
              category:  'INCOME',
              date:      now,
              isFlip:    false,
              flipAmount: 0,
            }, ...state.transactions],
          };
          return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState), paydayBanner: { amount: state.monthlyTakeHome } };
        });
      } finally {
        _paydayProcessing = false;
      }
    },

    dismissPaydayBanner: () => set({ paydayBanner: null } as any),

    // ── Squad & Presets (local) ───────────────────────────────────────────────

    saveSplitPreset: (preset) => {
      set((state: any) => ({
        customSplitPresets: [preset, ...state.customSplitPresets.filter((p: any) => p.id !== preset.id)],
      }));
    },
    deleteSplitPreset: (id) => {
      set((state: any) => ({
        customSplitPresets: state.customSplitPresets.filter((p: any) => p.id !== id),
      }));
    },
    addSquadMember: (name) => {
      const newMember: SquadMember = { id: crypto.randomUUID(), name: name.trim().toUpperCase(), isActive: true };
      set((state: any) => ({ squad: [...state.squad, newMember] }));
    },
    updateSquadMember: (id, name) => {
      set((state: any) => ({
        squad: state.squad.map((m: SquadMember) => m.id === id ? { ...m, name: name.trim().toUpperCase() } : m),
      }));
    },
    removeSquadMember: (id) => {
      set((state: any) => ({
        squad: state.squad.filter((m: SquadMember) => m.id !== id),
        customSplitPresets: state.customSplitPresets.map((p: CustomSplitPreset) => ({
          ...p,
          participantIds: p.participantIds.filter((pid: string) => pid !== id),
        })),
      }));
    },

    // ── Bill Queue (local) ────────────────────────────────────────────────────

    payBillFromQueue: (id) => {
      const { userId, billQueue, recurringBills, paidBillKeys } = get() as StoreState;
      const bill = (billQueue || []).find(b => b.id === id);
      if (!bill) return;
      const key = billKey(bill);
      // Idempotent: if this bill's key is already marked paid (double-tap, stale UI),
      // do nothing — prevents the duplicate BILL_PAYMENT transactions / double charge.
      if ((paidBillKeys || []).includes(key)) return;

      const txId = crypto.randomUUID();
      const now  = new Date().toISOString();
      const paymentTx: Transaction = {
        id:        txId,
        merchant:  `BILL: ${bill.name}`,
        amount:    bill.amount,
        category:  'BILL_PAYMENT',
        date:      now,
        isFlip:    false,
        flipAmount: 0,
      };

      // Mark the bill paid (source of truth) and re-derive the queue from it.
      const nextPaidKeys = [...(paidBillKeys || []), key];
      const nextQueue = deriveBillQueue(recurringBills, nextPaidKeys);
      const nextUpcoming = nextQueue.reduce((s, b) => s + b.amount, 0);

      set((state: any) => {
        const nextState = {
          ...state,
          paidBillKeys:  nextPaidKeys,
          billQueue:     nextQueue,
          upcomingBills: nextUpcoming,
          // Don't clamp at 0 — paying a bill you can't cover should show a real negative
          // balance (you're in the red), not silently hide the shortfall.
          liquidAssets:  state.liquidAssets - bill.amount,
          transactions:  [paymentTx, ...state.transactions],
        };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });

      if (userId) {
        const { liquidAssets } = get() as StoreState;
        // Bill payments are discrete deliberate actions involving money — they must
        // commit IMMEDIATELY (not via the debounced helper), or a quick refresh could
        // lose the paid state and resurrect the bill.
        (supabase.from('profiles') as any)
          .update({
            liquid_assets:  liquidAssets,
            upcoming_bills: nextUpcoming,
            paid_bill_keys: nextPaidKeys,
          })
          .eq('id', userId)
          .then((r: any) => { if (r?.error) console.error('[payBillFromQueue] profile update failed:', r.error); });
        (supabase.from('transactions') as any).insert({
          id:          txId,
          user_id:     userId,
          merchant:    `BILL: ${bill.name}`,
          amount:      bill.amount,
          category:    'BILL_PAYMENT',
          is_flip:     false,
          flip_amount: 0,
          date:        now,
        }).then((r: any) => { if (r?.error) console.error('[payBillFromQueue] tx insert failed:', r.error); });
      }
    },

    collectIou: (id) => {
      set((state: any) => {
        const entry = (state.iouLedger || []).find((e: IouEntry) => e.id === id);
        if (!entry) return state;
        const tx: Transaction = {
          id:        crypto.randomUUID(),
          merchant:  `IOU COLLECTED: ${entry.memberName}`,
          amount:    entry.amount,
          category:  'INCOME',
          date:      new Date().toISOString(),
          isFlip:    false,
          flipAmount: 0,
        };
        const nextState = {
          ...state,
          iouLedger:    (state.iouLedger || []).filter((e: IouEntry) => e.id !== id),
          liquidAssets: state.liquidAssets + entry.amount,
          transactions: [tx, ...state.transactions],
        };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });
    },

    appendIouEntries: (entries) => {
      set((state: any) => ({
        iouLedger: [...(state.iouLedger || []), ...entries],
      }));
    },
  })
);
