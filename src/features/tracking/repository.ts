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

/** The slice of AsyncStorage this repository needs (injectable for tests). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const STORAGE_KEY = 'senpai:tracking:v1';

/**
 * Local, on-device implementation backed by AsyncStorage.
 *
 * Stored as a single JSON blob keyed by mediaId. Because the whole list lives in
 * one blob, `upsert`/`remove` are read-modify-write — and the store fires them
 * fire-and-forget on every edit, so two edits to *different* titles could
 * otherwise interleave (both read the same map, each writes its own copy) and
 * silently drop one on next reload (F24). To prevent that, every operation runs
 * through a serial queue (`enqueue`): each op waits for the previous one to
 * finish before it reads, so read-modify-write cycles can never overlap.
 *
 * If lists grow large or we want a faster native store, drop in an
 * MmkvTrackingRepository implementing the same interface — that's the only file
 * that changes.
 */
export class AsyncStorageTrackingRepository implements TrackingRepository {
  constructor(private readonly storage: KeyValueStore = AsyncStorage) {}

  // Tail of the serial operation queue. Each enqueued op is chained after the
  // previous one regardless of whether that one resolved or rejected.
  private chain: Promise<unknown> = Promise.resolve();

  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const result = this.chain.then(op, op);
    // Keep the queue alive after a failure (and don't leak an unhandled
    // rejection on the chain holder); callers still see `result`'s outcome.
    this.chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async readMap(): Promise<Record<string, TrackEntry>> {
    try {
      const raw = await this.storage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, TrackEntry>) : {};
    } catch {
      return {};
    }
  }

  private async writeMap(map: Record<string, TrackEntry>): Promise<void> {
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(map));
  }

  getAll(): Promise<TrackEntry[]> {
    return this.enqueue(async () => Object.values(await this.readMap()));
  }

  upsert(entry: TrackEntry): Promise<void> {
    return this.enqueue(async () => {
      const map = await this.readMap();
      map[entry.mediaId] = entry;
      await this.writeMap(map);
    });
  }

  remove(mediaId: number): Promise<void> {
    return this.enqueue(async () => {
      const map = await this.readMap();
      delete map[mediaId];
      await this.writeMap(map);
    });
  }

  replaceAll(entries: TrackEntry[]): Promise<void> {
    return this.enqueue(async () => {
      const map: Record<string, TrackEntry> = {};
      for (const e of entries) map[e.mediaId] = e;
      await this.writeMap(map);
    });
  }
}

/** The single repository instance the app uses. Swap here to change backends. */
export const trackingRepository: TrackingRepository = new AsyncStorageTrackingRepository();
