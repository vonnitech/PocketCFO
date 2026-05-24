// =========================================================================
// ARCHITECT SIGNATURE: Proverbs 27:23
// "Be diligent to know the state of your flocks, and look well to your herds."
// =========================================================================

import { create } from 'zustand';
import { SquadMember, SplitTransaction, CustomSplitPreset } from '../types/split';
import { calculateTrueSafeSpend, calculateRawSafeSpend, UNIVERSAL_FLIP_RATE, toLocalDateKey } from '../core/math';
import { supabase } from '../core/supabase';

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
}

export interface IouEntry {
  id: string;
  memberName: string;
  memberId: string;
  amount: number;
  splitId: string;
  date: string;
}

export interface AppState {
  // Auth
  userId: string | null;
  dataLoaded: boolean;

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
  billQueue: BillQueueItem[];
  recurringBills: BillQueueItem[];
  iouLedger: IouEntry[];

  // Security
  isLocked: boolean;
  lockEnabled: boolean;
  securityPIN: string;
}

const calculatePrimaryVaultBalance = (vaults: Vault[]): number =>
  vaults.reduce((acc, vault) => acc + (vault.current || 0), 0);

export const INITIAL_STATE: AppState = {
  userId: null,
  dataLoaded: false,

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
    { id: 'momentum', visible: true },
    { id: 'alert', visible: true },
  ],
  impulses: [],
  reconHistory: [],
  rolloverPool: 0,
  firstName: '',
  privacyMode: false,
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
  iouLedger: [],

  isLocked: false,
  lockEnabled: false,
  securityPIN: '1234',
};

interface StoreActions {
  setPrivacyMode: (mode: boolean) => void;
  togglePrivacyMode: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  updateDashboardWidgets: (widgets: { id: string; visible: boolean }[]) => void;
  setState: (state: Partial<AppState>) => void;
  updateState: (fn: (prev: AppState) => AppState) => void;

  // Data sync
  fetchUserData: (userId: string) => Promise<void>;

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
  addDebt: (debt: Omit<Debt, 'id'>) => void;
  updateDebt: (id: string, updates: Partial<Omit<Debt, 'id'>>) => void;
  removeDebt: (id: string) => void;
  makeDebtPayment: (debtId: string, extraAmount: number) => void;
  updateBaseline: (income: number, bills: number, savingsGoal: number) => void;
  addVault: (name: string, target: number, asset_class: VaultAssetClass) => Promise<void>;
  addFundsToVault: (vaultId: string, amount: number) => Promise<void>;
  transferVaultFunds: (sourceId: string, destinationId: string, amount: number) => Promise<void>;
  renameVault: (id: string, name: string) => void;
  deleteVault: (id: string) => void;
  restoreVault: (id: string) => void;
  permanentlyDeleteVault: (id: string) => void;
  processPayday: () => Promise<void>;
}

export type StoreState = AppState & StoreActions;

export const useStore = create<StoreState>()(
  (set, get) => ({
    ...INITIAL_STATE,

    // ── Sync ─────────────────────────────────────────────────────────────────

    fetchUserData: async (userId) => {
      const [profileRes, txRes, vaultRes, deletedVaultRes, debtRes, subRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(500),
        supabase.from('vaults').select('*').eq('user_id', userId).eq('deleted', false),
        supabase.from('vaults').select('*').eq('user_id', userId).eq('deleted', true),
        supabase.from('debts').select('*').eq('user_id', userId),
        supabase.from('subscriptions').select('*').eq('user_id', userId),
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

      set((state: any) => {
        const merged: Partial<AppState> = {
          userId,
          dataLoaded: true,
          transactions,
          vaults,
          deletedVaults,
          debts,
          subscriptions,
          primaryVaultBalance: calculatePrimaryVaultBalance(vaults),
        };

        if (profile) {
          const widgets = profile.dashboard_widgets;
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
            hasCompletedOnboarding: Boolean(profile.has_completed_onboarding),
            isConfigured:          Boolean(profile.is_configured),
            dashboardWidgets:      Array.isArray(widgets) ? widgets : state.dashboardWidgets,
            ...(profile.theme_primary_color || profile.theme_capture_color ? {
              themeColors: {
                primary:   profile.theme_primary_color ? String(profile.theme_primary_color) : undefined,
                secondary: profile.theme_capture_color ? String(profile.theme_capture_color) : undefined,
              },
            } : {}),
          });
        } else {
          // New user — profile row created by trigger but all fields are defaults
          merged.userId      = userId;
          merged.dataLoaded  = true;
          merged.isConfigured = false;
        }

        const nextState = { ...state, ...merged };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });
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

    updateDashboardWidgets: async (widgets) => {
      const { userId } = get() as StoreState;
      set({ dashboardWidgets: widgets } as any);
      if (!userId) return;
      await (supabase.from('profiles') as any).update({ dashboard_widgets: widgets }).eq('id', userId);
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
      const { userId, hardDailyCap, recurringBills, vaults: currentVaults, lastSweepDate } = get() as StoreState;
      if (!userId) return;

      const capToUse      = newHardDailyCap !== undefined ? newHardDailyCap : (hardDailyCap ?? 0);
      const recurringToUse: BillQueueItem[] = newBillQueue !== undefined ? newBillQueue : (recurringBills || []);
      const freshQueue: BillQueueItem[]     = recurringToUse.map(b => ({ ...b, id: crypto.randomUUID() }));
      const billsTotal    = recurringToUse.reduce((s, b) => s + b.amount, 0);

      const calcState = {
        ...(get() as StoreState),
        liquidAssets: capital,
        nextPayday,
        upcomingBills: billsTotal,
        recurringBills: recurringToUse,
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

      // Profile upsert
      const { error: profileError } = await (supabase.from('profiles') as any).update({
        liquid_assets:          finalLiquid,
        next_payday:            nextPayday || null,
        upcoming_bills:         billsTotal,
        hard_daily_cap:         capToUse,
        is_configured:          true,
        has_completed_onboarding: true,
        last_sweep_date:        doSweep ? todayKey : (lastSweepDate || null),
      }).eq('id', userId);
      if (profileError) return;

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
      }

      // Update local state
      set((state: any) => {
        const nextVaults = doSweep && firstVault
          ? state.vaults.map((v: any) => v.id === firstVault.id ? { ...v, current: v.current + sweepAmount } : v)
          : state.vaults;

        const baseNext = {
          ...state,
          liquidAssets:          finalLiquid,
          nextPayday,
          upcomingBills:         billsTotal,
          recurringBills:        recurringToUse,
          billQueue:             freshQueue,
          isConfigured:          true,
          hasCompletedOnboarding: true,
          hardDailyCap:          capToUse,
          vaults:                nextVaults,
          primaryVaultBalance:   calculatePrimaryVaultBalance(nextVaults),
          ...(doSweep && sweepTxId ? {
            lastSweepDate: todayKey,
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
          } : {}),
        };
        return { ...baseNext, safeSpendLimit: calculateTrueSafeSpend(baseNext) };
      });
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

      const { error: txError } = await supabase.from('transactions').insert(inserts as any);
      if (txError) return;

      // Sync liquid_assets to profiles so it persists across sessions
      await (supabase.from('profiles') as any)
        .update({ liquid_assets: liquidAssets - amount - penalty })
        .eq('id', userId);

      if (penalty > 0 && firstVault) {
        await (supabase.from('vaults') as any).update({ current: firstVault.current + penalty }).eq('id', firstVault.id);
      }

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

      const txId = crypto.randomUUID();
      const now  = new Date().toISOString();

      const { error } = await supabase.from('transactions').insert({
        id:          txId,
        user_id:     userId,
        merchant:    source.trim().toUpperCase() || 'EXTRA INCOME',
        amount,
        category:    'INCOME',
        is_flip:     false,
        flip_amount: 0,
        date:        now,
      } as any);
      if (error) return;

      set((state: any) => {
        const tx: Transaction = {
          id:        txId,
          merchant:  source.trim().toUpperCase() || 'EXTRA INCOME',
          amount,
          category:  'INCOME',
          date:      now,
          isFlip:    false,
          flipAmount: 0,
        };
        const nextState = {
          ...state,
          liquidAssets: state.liquidAssets + amount,
          transactions: [tx, ...state.transactions],
        };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });
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
          liquidAssets:        state.liquidAssets - split.personalDeduction - split.personalFlipCaptured,
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

      set((state: any) => ({ debts: [...state.debts, newDebt] }));
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

      set((state: any) => ({
        debts: state.debts.map((d: Debt) => d.id === id ? { ...d, ...updates } : d),
      }));
    },

    removeDebt: async (id) => {
      const { userId } = get() as StoreState;
      if (!userId) return;

      const { error } = await (supabase.from('debts') as any).delete().eq('id', id);
      if (error) return;

      set((state: any) => ({ debts: state.debts.filter((d: Debt) => d.id !== id) }));
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

    updateBaseline: async (income, bills, savingsGoal) => {
      const { userId } = get() as StoreState;
      if (!userId) return;

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

      // Requires: ALTER TABLE vaults ADD COLUMN asset_class TEXT DEFAULT 'SINKING_FUND';
      if (userId) {
        await (supabase.from('vaults') as any).insert({
          id:          newVault.id,
          user_id:     userId,
          name:        newVault.name,
          target:      newVault.target,
          current:     0,
          asset_class: newVault.asset_class,
          deleted:     false,
        });
      }

      set((state: any) => {
        const nextVaults = [...state.vaults, newVault];
        return {
          vaults:              nextVaults,
          primaryVaultBalance: calculatePrimaryVaultBalance(nextVaults),
        };
      });
    },

    addFundsToVault: async (vaultId, amount) => {
      const { userId, vaults, liquidAssets } = get() as StoreState;
      if (amount <= 0 || amount > liquidAssets) return;
      const vault = vaults.find(v => v.id === vaultId);
      if (!vault) return;

      const txId = crypto.randomUUID();
      const now  = new Date().toISOString();

      if (userId) {
        await Promise.all([
          (supabase.from('vaults') as any).update({ current: vault.current + amount }).eq('id', vaultId),
          (supabase.from('profiles') as any).update({ liquid_assets: liquidAssets - amount }).eq('id', userId),
          (supabase.from('transactions') as any).insert({
            id:          txId,
            user_id:     userId,
            merchant:    `VAULT: ${vault.name}`,
            amount,
            category:    'VAULT_DEPOSIT',
            is_flip:     false,
            flip_amount: 0,
            date:        now,
          }),
        ]);
      }

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
    },

    transferVaultFunds: async (sourceId, destinationId, amount) => {
      const { userId, vaults, liquidAssets } = get() as StoreState;
      const source = vaults.find(v => v.id === sourceId);
      if (!source || amount <= 0 || amount > source.current) return;

      const toLiquid = destinationId === 'LIQUID';
      const destVault = toLiquid ? null : vaults.find(v => v.id === destinationId);
      if (!toLiquid && !destVault) return;

      const txId = crypto.randomUUID();
      const now  = new Date().toISOString();
      const merchant = toLiquid
        ? `WITHDRAWAL: ${source.name}`
        : `TRANSFER: ${source.name} → ${destVault!.name}`;
      const category = toLiquid ? 'VAULT_WITHDRAWAL' : 'VAULT_TRANSFER';

      if (userId) {
        const dbOps: Promise<unknown>[] = [
          (supabase.from('vaults') as any).update({ current: source.current - amount }).eq('id', sourceId),
          (supabase.from('transactions') as any).insert({
            id: txId, user_id: userId, merchant, amount,
            category, is_flip: false, flip_amount: 0, date: now,
          }),
        ];
        if (toLiquid) {
          dbOps.push(
            (supabase.from('profiles') as any).update({ liquid_assets: liquidAssets + amount }).eq('id', userId)
          );
        } else {
          dbOps.push(
            (supabase.from('vaults') as any).update({ current: destVault!.current + amount }).eq('id', destinationId)
          );
        }
        await Promise.all(dbOps);
      }

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
    },

    renameVault: async (id, name) => {
      const { userId } = get() as StoreState;
      if (!userId) return;

      const { error } = await (supabase.from('vaults') as any).update({ name: name.trim() }).eq('id', id);
      if (error) return;

      set((state: any) => ({
        vaults: state.vaults.map((v: Vault) => v.id === id ? { ...v, name: name.trim() } : v),
      }));
    },

    deleteVault: async (id) => {
      const { userId } = get() as StoreState;
      if (!userId) return;

      const { error } = await (supabase.from('vaults') as any).update({ deleted: true }).eq('id', id);
      if (error) return;

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
    },

    restoreVault: async (id) => {
      const { userId } = get() as StoreState;
      if (!userId) return;

      const { error } = await (supabase.from('vaults') as any).update({ deleted: false }).eq('id', id);
      if (error) return;

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
    },

    permanentlyDeleteVault: (id) => {
      const { userId } = get() as StoreState;
      if (userId) {
        (supabase.from('vaults') as any).delete().eq('id', id);
      }
      set((state: any) => ({
        deletedVaults: (state.deletedVaults || []).filter((v: Vault) => v.id !== id),
      }));
    },

    processPayday: async () => {
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

      if (userId) {
        await Promise.all([
          (supabase.from('profiles') as any).update({
            liquid_assets: liquidAssets + monthlyTakeHome,
            next_payday:   newNextPayday,
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
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });
    },

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
      set((state: any) => {
        const bill = (state.billQueue || []).find((b: BillQueueItem) => b.id === id);
        if (!bill) return state;
        const nextState = {
          ...state,
          billQueue:     (state.billQueue || []).filter((b: BillQueueItem) => b.id !== id),
          upcomingBills: Math.max(0, (state.upcomingBills || 0) - bill.amount),
        };
        return { ...nextState, safeSpendLimit: calculateTrueSafeSpend(nextState) };
      });
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
