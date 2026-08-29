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
  nextBillingDate?: string;
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

export interface Impulse {
  id: string;
  name: string;
  taxRate: number; // 0 to 1 (e.g. 0.5 for 50%)
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
}

// NOTE: AppState and INITIAL_STATE used to be duplicated here. They were dead
// weight - every consumer imports both from 'store/useStore', and this copy had
// drifted (it still listed a 'momentum' dashboard widget removed from the UI).
// The live definitions are in src/store/useStore.ts; the widget list is in
// src/core/widgets.ts. The interfaces above are still imported by other files.
