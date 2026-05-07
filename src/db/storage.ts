import { openDB, IDBPDatabase } from 'idb';
import { AppState } from '../store/useStore';

const DB_NAME = 'pocket_cfo_db';
const STORE_NAME = 'app_state';
const DB_VERSION = 1;

export async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export async function saveState(state: AppState): Promise<void> {
  const db = await initDB();
  await db.put(STORE_NAME, state, 'current_state');
}

export async function loadState(): Promise<AppState | null> {
  try {
    const db = await initDB();
    return (await db.get(STORE_NAME, 'current_state')) || null;
  } catch (error) {
    console.error('Error loading state from IDB:', error);
    return null;
  }
}
