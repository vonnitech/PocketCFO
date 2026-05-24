import { DBSchema } from 'idb';

// The Ledger: Every dollar that moves.
export interface Transaction {
  id: string;                 // UUID
  timestamp: number;          // Epoch time for hyper-fast sorting
  type: 'BASE' | 'IMPULSE_HIT' | 'FLIP_CAPTURE' | 'SPLIT_EXECUTION';
  amount: number;             // Raw dollar amount
  category: string;           // e.g., 'UberEats', 'Rent', 'Squad Dinner'
  isPenalty: boolean;         // Did this trigger the Impulse Tax?
  resultingRunway: number;    // Snapshot of Safe Spend immediately after the hit
}

// Cancelled Subscription Record.
export interface CancelledSub {
  id: string;
  name: string;
  monthlyCost: number;
  status: 'ACTIVE' | 'LOW_USE' | 'IDLE' | 'KILLED';
  dateAdded: number;
  dateKilled: number | null;
}

// The Wealth Targets: Track every captured dollar.
export interface VaultDeposit {
  id: string;
  timestamp: number;
  source: 'IMPULSE_TAX' | 'SQUAD_FLIP' | 'SUB_CANCELLED' | 'MANUAL';
  amountCaptured: number;
  vaultId: string;
}

// ── Supabase generated-type stub ──────────────────────────────────────────
// Replace this with the output of `npx supabase gen types typescript` once
// the project is linked. Until then this satisfies the createClient<Database> generic.
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row:    Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      transactions: {
        Row:    Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      vaults: {
        Row:    Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      debts: {
        Row:    Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      subscriptions: {
        Row:    Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
    Views:     Record<string, never>;
    Functions: Record<string, never>;
    Enums:     Record<string, never>;
  };
};

// ── Legacy IndexedDB schema (kept for migration reference) ─────────────────

// The Core idb Schema Definition
export interface PocketCFO_DB extends DBSchema {
  transactions: {
    key: string;
    value: Transaction;
    indexes: { 'by-date': number; 'by-type': string };
  };
  leeches: {
    key: string;
    value: CancelledSub;
    indexes: { 'by-status': string };
  };
  vault_history: {
    key: string;
    value: VaultDeposit;
    indexes: { 'by-vault': string; 'by-date': number };
  };
}
