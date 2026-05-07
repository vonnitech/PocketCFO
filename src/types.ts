/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  taxRate: number; // 0 to 1 (e.g. 0.5 for 50%)
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
};
