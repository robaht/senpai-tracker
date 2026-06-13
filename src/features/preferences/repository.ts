import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PREFERENCES, type Preferences } from './types';

/**
 * Storage contract for user preferences (theme, and future settings).
 *
 * Same seam as `TrackingRepository`: the store depends only on this interface,
 * so a future `SupabasePreferencesRepository` (so prefs sync with the account in
 * F1) is a drop-in swap of the instance exported below.
 */
export interface PreferencesRepository {
  get(): Promise<Preferences>;
  save(prefs: Preferences): Promise<void>;
}

const STORAGE_KEY = 'senpai:prefs:v1';

class AsyncStoragePreferencesRepository implements PreferencesRepository {
  async get(): Promise<Preferences> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_PREFERENCES;
      // Merge over defaults so older stored blobs missing a key stay valid.
      return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  async save(prefs: Preferences): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }
}

export const preferencesRepository: PreferencesRepository =
  new AsyncStoragePreferencesRepository();
