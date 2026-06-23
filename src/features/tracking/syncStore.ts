import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Observable sync status for the UI (F1) — whether a sync is in flight and when
 * the last one finished. `lastSyncedAt` is persisted so the timestamp survives a
 * reload. The actual sync work lives in `sync.ts`, which drives this store.
 */
const KEY = 'senpai:last-sync:v1';

interface SyncState {
  syncing: boolean;
  lastSyncedAt: number | null;
  hydrate: () => Promise<void>;
  setSyncing: (value: boolean) => void;
  markSynced: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  syncing: false,
  lastSyncedAt: null,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) set({ lastSyncedAt: Number(raw) || null });
    } catch {
      // ignore — non-fatal
    }
  },

  setSyncing: (value) => set({ syncing: value }),

  markSynced: () => {
    const ts = Date.now();
    set({ lastSyncedAt: ts, syncing: false });
    void AsyncStorage.setItem(KEY, String(ts));
  },
}));
