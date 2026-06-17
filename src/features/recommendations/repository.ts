import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage for "not interested" recommendation ids — titles the user swiped away
 * so they never resurface in For You / the swipe deck.
 *
 * Same "local now, sync later" seam as TrackingRepository: just a set of AniList
 * media ids, persisted as a JSON array.
 */
export interface DismissedRepository {
  getAll(): Promise<number[]>;
  save(ids: number[]): Promise<void>;
}

const STORAGE_KEY = 'senpai:recs:dismissed:v1';

class AsyncStorageDismissedRepository implements DismissedRepository {
  async getAll(): Promise<number[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as number[]) : [];
    } catch {
      return [];
    }
  }

  async save(ids: number[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }
}

/** The single repository instance the app uses. Swap here to change backends. */
export const dismissedRepository: DismissedRepository = new AsyncStorageDismissedRepository();
