import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SquadMember, SplitTransaction, CustomSplitPreset } from '../types/split';
import { calculateTrueSafeSpend } from '../core/math';

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

export interface Vault {
  id: string;
  name: string;
  target: number;
  current: number;
}

export interface Debt {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minPayment: number;
}

export interface Gremlin {
  id: string;
  name: string;
  taxRate: number; 
}

export interface ReconEntry {
  id: string;
  date: string;
  rawSpend: number;
  gremlinSpend: number;
  taxAmount: number;
  surplus: number;
  action: 'roll' | 'stash';
  gremlinId?: string;
}

export interface AppState {
  isConfigured: boolean;
  monthlyTakeHome: number;
  fixedBills: number;
  monthlySavingsGoal: number;
  transactions: Transaction[];
  subscriptions: Subscription[];
  vaults: Vault[];
  debts: Debt[];
  salary: {
    current: number;
    target: number;
  };
  stats: {
    level: number;
    experience: number;
    flipsExecuted: number;
    leechesKilled: number;
    lifetimeCapture: number;
  };
  extraCashPool: number;
  dashboardWidgets: { id: string; visible: boolean }[];
  gremlins: Gremlin[];
  reconHistory: ReconEntry[];
  rolloverPool: number;
  themeColors?: {
    primary?: string;
    secondary?: string;
  };
  ghostMode: boolean;
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
}

export const INITIAL_STATE: AppState = {
  isConfigured: false,
  monthlyTakeHome: 0,
  fixedBills: 0,
  monthlySavingsGoal: 0,
  transactions: [],
  subscriptions: [
    { id: '1', name: 'FitApp Plus', amount: 19.99, usage: 'Idle', billingCycle: 'Monthly' },
    { id: '2', name: 'StreamBox', amount: 15.99, usage: 'Active', billingCycle: 'Monthly' },
  ],
  vaults: [
    { id: '1', name: 'Emergency Fund', target: 5000, current: 0 },
    { id: '2', name: 'MacBook Pro', target: 2400, current: 0 },
  ],
  debts: [
    { id: '1', name: 'Credit Card A', balance: 4500, interestRate: 24.99, minPayment: 150 },
  ],
  salary: {
    current: 0,
    target: 0,
  },
  stats: {
    level: 1,
    experience: 0,
    flipsExecuted: 0,
    leechesKilled: 0,
    lifetimeCapture: 0,
  },
  extraCashPool: 0,
  dashboardWidgets: [
    { id: 'safe-spend', visible: true },
    { id: 'vault-status', visible: true },
    { id: 'momentum', visible: true },
    { id: 'alert', visible: true },
  ],
  gremlins: [],
  reconHistory: [],
  rolloverPool: 0,
  ghostMode: false,
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
  
  // CFO Initial state
  liquidAssets: 0,
  fixedBurn: 0,
  safeSpendLimit: 0,
  primaryVaultBalance: 0,
};

interface StoreActions {
  setGhostMode: (mode: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setState: (state: Partial<AppState>) => void;
  updateState: (fn: (prev: AppState) => AppState) => void;
  
  // CFO Actions
  setBaseline: (liquid: number, fixed: number, goal: number) => void;
  executeGremlinHit: (amount: number, taxRate: number) => void;
  logSpend: (amount: number) => void;
  addSplitTransaction: (split: SplitTransaction) => void;
  saveSplitPreset: (preset: CustomSplitPreset) => void;
  deleteSplitPreset: (id: string) => void;
}

export type StoreState = AppState & StoreActions;

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      setGhostMode: (mode) => set({ ghostMode: mode } as any),
      setTheme: (theme) => set({ theme } as any),
      setState: (newState) => set((state) => ({ ...state, ...newState } as any)),
      updateState: (fn) => set((state: any) => {
        const next = fn(state as AppState);
        return { 
          ...next,
          safeSpendLimit: calculateTrueSafeSpend(next)
        } as any;
      }),
      setBaseline: (liquid, fixed, goal) => {
        set((state: any) => {
          const nextState = {
            ...state,
            liquidAssets: liquid,
            fixedBurn: fixed,
            monthlySavingsGoal: goal,
            primaryVaultBalance: goal,
            isConfigured: true
          };
          return {
            ...nextState,
            safeSpendLimit: calculateTrueSafeSpend(nextState)
          };
        });
      },
      executeGremlinHit: (amount, taxRate) => {
        const penalty = amount * taxRate;
        const newTransaction: Transaction = {
          id: Math.random().toString(36).substr(2, 9),
          merchant: 'GREMLIN_HIT',
          amount: amount,
          category: 'PENALTY',
          date: new Date().toISOString(),
          isFlip: true,
          flipAmount: penalty
        };
        
        set((state: any) => {
          const nextState = {
            ...state,
            liquidAssets: state.liquidAssets - amount - penalty,
            primaryVaultBalance: state.primaryVaultBalance + penalty,
            transactions: [newTransaction, ...state.transactions]
          };
          return {
            ...nextState,
            safeSpendLimit: calculateTrueSafeSpend(nextState)
          };
        });
      },
      logSpend: (amount) => {
        const newTransaction: Transaction = {
          id: Math.random().toString(36).substr(2, 9),
          merchant: 'MANUAL_LOG',
          amount: amount,
          category: 'GENERAL',
          date: new Date().toISOString(),
          isFlip: false,
          flipAmount: 0
        };

        set((state: any) => {
          const nextState = {
            ...state,
            liquidAssets: state.liquidAssets - amount,
            transactions: [newTransaction, ...state.transactions]
          };
          return {
            ...nextState,
            safeSpendLimit: calculateTrueSafeSpend(nextState)
          };
        });
      },
      addSplitTransaction: (split) => {
        set((state: any) => {
          const nextState = {
            ...state,
            liquidAssets: state.liquidAssets - split.personalDeduction - split.personalFlipCaptured,
            primaryVaultBalance: state.primaryVaultBalance + split.personalFlipCaptured,
            splitHistory: [split, ...state.splitHistory],
            // Split also adds to transactions to be seen by math.ts
            transactions: [{
              id: split.id,
              merchant: 'SPLIT_TRANSACTION',
              amount: split.personalDeduction,
              category: 'SOCIAL',
              date: split.timestamp,
              isFlip: true,
              flipAmount: split.personalFlipCaptured
            }, ...state.transactions]
          };
          return {
            ...nextState,
            safeSpendLimit: calculateTrueSafeSpend(nextState)
          };
        });
      },
      saveSplitPreset: (preset) => {
        set((state: any) => ({
          customSplitPresets: [preset, ...state.customSplitPresets.filter((p: any) => p.id !== preset.id)]
        }));
      },
      deleteSplitPreset: (id) => {
        set((state: any) => ({
          customSplitPresets: state.customSplitPresets.filter((p: any) => p.id !== id)
        }));
      }
    }),
    {
      name: 'pocket-cfo-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
