import { openDB } from 'idb';
import type { PocketCFO_DB, Leech } from '../types/database';
import { SplitTransaction } from '../types/split';

const DB_NAME = 'pocket_cfo_ledger';
const DB_VERSION = 1;

export const initDB = async () => {
  const db = await openDB<PocketCFO_DB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 1. Initialize the Main Transaction Ledger
      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('by-date', 'timestamp');
        txStore.createIndex('by-type', 'type');
      }

      // 2. Initialize the Leech Hit-List
      if (!db.objectStoreNames.contains('leeches')) {
        const leechStore = db.createObjectStore('leeches', { keyPath: 'id' });
        leechStore.createIndex('by-status', 'status');
      }

      // 3. Initialize the Vault Deposit History
      if (!db.objectStoreNames.contains('vault_history')) {
        const vaultStore = db.createObjectStore('vault_history', { keyPath: 'id' });
        vaultStore.createIndex('by-vault', 'vaultId');
        vaultStore.createIndex('by-date', 'timestamp');
      }
    },
  });
  
  return db;
};

export const executeLeechKill = async (leech: Leech) => {
  const db = await initDB();
  const tx = db.transaction(['leeches', 'vault_history'], 'readwrite');
  
  // 1. Mark the Leech as Terminated
  const updatedLeech = { ...leech, status: 'KILLED' as const, dateKilled: Date.now() };
  await tx.objectStore('leeches').put(updatedLeech);
  
  // 2. Log the Permanent Wealth Capture to the Vault
  await tx.objectStore('vault_history').add({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    source: 'LEECH_PURGE',
    amountCaptured: leech.monthlyCost,
    vaultId: 'primary_vault', // Routes to main goal
  });

  await tx.done;
};

export const saveSplitTransaction = async (split: SplitTransaction, safeSpendAfter: number) => {
  const db = await initDB();
  const tx = db.transaction(['transactions', 'vault_history'], 'readwrite');

  // 1. Log the main hit to the ledger
  await tx.objectStore('transactions').add({
    id: split.id,
    timestamp: Date.parse(split.timestamp),
    type: 'SPLIT_EXECUTION',
    amount: split.personalDeduction,
    category: `SQUAD_SPLIT_${split.presetUsed}`,
    isPenalty: true, // Splits always capture 20% by default in this prototype
    resultingRunway: safeSpendAfter,
  });

  // 2. Log the captured flip to the wealth vault
  if (split.personalFlipCaptured > 0) {
    await tx.objectStore('vault_history').add({
      id: crypto.randomUUID(),
      timestamp: Date.parse(split.timestamp),
      source: 'SQUAD_FLIP',
      amountCaptured: split.personalFlipCaptured,
      vaultId: 'primary_vault',
    });
  }

  await tx.done;
};
