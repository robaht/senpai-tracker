import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TrackEntry } from './types';

/**
 * Storage contract for the user's tracked list.
 *
 * This interface is the seam that makes the app "local now, sync later". The UI
 * and store depend ONLY on this interface — never on a concrete backend. To add
 * cross-device sync later, implement `TrackingRepository` against AniList OAuth
 * or Supabase and swap the instance exported at the bottom of this file. No
 * screen or store code changes.
 */
export interface TrackingRepository {
  getAll(): Promise<TrackEntry[]>;
  /** Insert or replace a single entry. */
  upsert(entry: TrackEntry): Promise<void>;
  remove(mediaId: number): Promise<void>;
  /** Replace the entire list (used for bulk import / future sync merge). */
  replaceAll(entries: TrackEntry[]): Promise<void>;
}

const STORAGE_KEY = 'senpai:tracking:v1';

/**
 * Local, on-device implementation backed by AsyncStorage.
 *
 * Stored as a single JSON blob keyed by mediaId. This is plenty fast for a
 * personal list (hundreds of entries). If lists grow large or we want a faster
 * native store, drop in an MmkvTrackingRepository implementing the same
 * interface — that's the only file that changes.
 */
class AsyncStorageTrackingRepository implements TrackingRepository {
  private async readMap(): Promise<Record<string, TrackEntry>> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, TrackEntry>) : {};
    } catch {
      return {};
    }
  }

  private async writeMap(map: Record<string, TrackEntry>): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }

  async getAll(): Promise<TrackEntry[]> {
    const map = await this.readMap();
    return Object.values(map);
  }

  async upsert(entry: TrackEntry): Promise<void> {
    const map = await this.readMap();
    map[entry.mediaId] = entry;
    await this.writeMap(map);
  }

  async remove(mediaId: number): Promise<void> {
    const map = await this.readMap();
    delete map[mediaId];
    await this.writeMap(map);
  }

  async replaceAll(entries: TrackEntry[]): Promise<void> {
    const map: Record<string, TrackEntry> = {};
    for (const e of entries) map[e.mediaId] = e;
    await this.writeMap(map);
  }
}

/** The single repository instance the app uses. Swap here to change backends. */
export const trackingRepository: TrackingRepository = new AsyncStorageTrackingRepository();
