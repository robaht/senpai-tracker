import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ComfortPick } from './types';

/**
 * Storage for the Comfort Corner — the user's curated comfort picks.
 *
 * Same "local now, sync later" seam as TrackingRepository: the store depends on
 * this interface, not on a concrete backend. Stored as a single ordered JSON
 * array (the shelf order is meaningful), which is plenty for a personal shelf.
 */
export interface ComfortRepository {
  getAll(): Promise<ComfortPick[]>;
  /** Replace the whole ordered shelf. */
  save(picks: ComfortPick[]): Promise<void>;
}

const STORAGE_KEY = 'senpai:comfort:v1';

class AsyncStorageComfortRepository implements ComfortRepository {
  async getAll(): Promise<ComfortPick[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ComfortPick[]) : [];
    } catch {
      return [];
    }
  }

  async save(picks: ComfortPick[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
  }
}

/** The single repository instance the app uses. Swap here to change backends. */
export const comfortRepository: ComfortRepository = new AsyncStorageComfortRepository();
