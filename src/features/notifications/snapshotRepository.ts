import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationSnapshot } from './types';

/**
 * Storage contract for per-title detection snapshots — the dedupe cache
 * `detect.ts` diffs each fresh AniList fetch against. Same pattern as
 * `NotificationRepository`, keyed by `mediaId` instead of notification id.
 */
export interface SnapshotRepository {
  getAll(): Promise<NotificationSnapshot[]>;
  get(mediaId: number): Promise<NotificationSnapshot | null>;
  upsert(s: NotificationSnapshot): Promise<void>;
  remove(mediaId: number): Promise<void>;
}

/** The slice of AsyncStorage this repository needs (injectable for tests). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const STORAGE_KEY = 'senpai:notification-snapshots:v1';

/**
 * Local, on-device implementation backed by AsyncStorage. Same
 * read-modify-write hazard and serial-queue (`enqueue`) fix as
 * `AsyncStorageTrackingRepository` / `AsyncStorageNotificationRepository` —
 * copy that pattern, don't reinvent it.
 */
export class AsyncStorageSnapshotRepository implements SnapshotRepository {
  constructor(private readonly storage: KeyValueStore = AsyncStorage) {}

  private chain: Promise<unknown> = Promise.resolve();

  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const result = this.chain.then(op, op);
    this.chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async readMap(): Promise<Record<number, NotificationSnapshot>> {
    try {
      const raw = await this.storage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<number, NotificationSnapshot>) : {};
    } catch {
      return {};
    }
  }

  private async writeMap(map: Record<number, NotificationSnapshot>): Promise<void> {
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(map));
  }

  getAll(): Promise<NotificationSnapshot[]> {
    return this.enqueue(async () => Object.values(await this.readMap()));
  }

  get(mediaId: number): Promise<NotificationSnapshot | null> {
    return this.enqueue(async () => (await this.readMap())[mediaId] ?? null);
  }

  upsert(s: NotificationSnapshot): Promise<void> {
    return this.enqueue(async () => {
      const map = await this.readMap();
      map[s.mediaId] = s;
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
}

/** The single repository instance the app uses. */
export const snapshotRepository: SnapshotRepository = new AsyncStorageSnapshotRepository();
