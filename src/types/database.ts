import { DBSchema } from 'idb';

// The Ledger: Every dollar that moves.
export interface Transaction {
  id: string;                 // UUID
  timestamp: number;          // Epoch time for hyper-fast sorting
  type: 'BASE' | 'GREMLIN_HIT' | 'FLIP_CAPTURE' | 'SPLIT_EXECUTION';
  amount: number;             // Raw dollar amount
  category: string;           // e.g., 'UberEats', 'Rent', 'Squad Dinner'
  isPenalty: boolean;         // Did this trigger the Gremlin Tax?
  resultingRunway: number;    // Snapshot of Safe Spend immediately after the hit
}

// The Hit-List: Active and Dead Subscriptions.
export interface Leech {
  id: string;
  name: string;
  monthlyCost: number;
  status: 'ACTIVE' | 'LOW_USE' | 'IDLE' | 'KILLED';
  dateAdded: number;
  dateKilled: number | null;  // Time of execution
}

// The Wealth Targets: Track every captured dollar.
export interface VaultDeposit {
  id: string;
  timestamp: number;
  source: 'GREMLIN_TAX' | 'SQUAD_FLIP' | 'LEECH_PURGE' | 'MANUAL';
  amountCaptured: number;
  vaultId: string;
}

// The Core idb Schema Definition
export interface PocketCFO_DB extends DBSchema {
  transactions: {
    key: string;
    value: Transaction;
    indexes: { 'by-date': number; 'by-type': string };
  };
  leeches: {
    key: string;
    value: Leech;
    indexes: { 'by-status': string };
  };
  vault_history: {
    key: string;
    value: VaultDeposit;
    indexes: { 'by-vault': string; 'by-date': number };
  };
}
