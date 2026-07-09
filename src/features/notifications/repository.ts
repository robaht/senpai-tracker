import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppNotification } from './types';

/**
 * Storage contract for the notification feed. Mirrors
 * `src/features/tracking/repository.ts`'s `TrackingRepository` — same seam
 * (UI/store depend only on this interface), same reasoning.
 */
export interface NotificationRepository {
  getAll(): Promise<AppNotification[]>;
  upsert(n: AppNotification): Promise<void>; // used by markRead too
  remove(id: string): Promise<void>;
  replaceAll(n: AppNotification[]): Promise<void>; // used by prune / mark-all-read bulk write
}

/** The slice of AsyncStorage this repository needs (injectable for tests). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const STORAGE_KEY = 'senpai:notifications:v1';

/** Cap on stored notifications — see `trim` below. */
const MAX_STORED = 200;

/**
 * Keep the stored list from growing unbounded: once it exceeds `MAX_STORED`,
 * drop the oldest **read** notifications first, down to the cap. Unread rows
 * are never dropped for capacity reasons (even if that leaves the list
 * over-cap) — losing an unseen alert is worse than a slightly bigger blob.
 */
function trim(list: AppNotification[]): AppNotification[] {
  const over = list.length - MAX_STORED;
  if (over <= 0) return list;
  const readOldestFirst = list.filter((n) => n.read).sort((a, b) => a.createdAt - b.createdAt);
  const toDrop = new Set(readOldestFirst.slice(0, over).map((n) => n.id));
  if (toDrop.size === 0) return list;
  return list.filter((n) => !toDrop.has(n.id));
}

/**
 * Local, on-device implementation backed by AsyncStorage.
 *
 * Stored as a single JSON blob keyed by notification id. Same read-modify-write
 * hazard as `AsyncStorageTrackingRepository` — two overlapping writes (e.g. a
 * detection pass and a `markRead` tap) could otherwise interleave and silently
 * drop one on next reload. Every operation runs through a serial queue
 * (`enqueue`) to prevent that: each op waits for the previous one to finish
 * before it reads.
 */
export class AsyncStorageNotificationRepository implements NotificationRepository {
  constructor(private readonly storage: KeyValueStore = AsyncStorage) {}

  // Tail of the serial operation queue. Each enqueued op is chained after the
  // previous one regardless of whether that one resolved or rejected.
  private chain: Promise<unknown> = Promise.resolve();

  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const result = this.chain.then(op, op);
    this.chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async readMap(): Promise<Record<string, AppNotification>> {
    try {
      const raw = await this.storage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, AppNotification>) : {};
    } catch {
      return {};
    }
  }

  /** Trims to `MAX_STORED` (drop-oldest-read policy) before every write. */
  private async writeMap(map: Record<string, AppNotification>): Promise<void> {
    const trimmed = trim(Object.values(map));
    const next: Record<string, AppNotification> = {};
    for (const n of trimmed) next[n.id] = n;
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  getAll(): Promise<AppNotification[]> {
    return this.enqueue(async () => Object.values(await this.readMap()));
  }

  upsert(n: AppNotification): Promise<void> {
    return this.enqueue(async () => {
      const map = await this.readMap();
      map[n.id] = n;
      await this.writeMap(map);
    });
  }

  remove(id: string): Promise<void> {
    return this.enqueue(async () => {
      const map = await this.readMap();
      delete map[id];
      await this.writeMap(map);
    });
  }

  replaceAll(n: AppNotification[]): Promise<void> {
    return this.enqueue(async () => {
      const map: Record<string, AppNotification> = {};
      for (const e of n) map[e.id] = e;
      await this.writeMap(map);
    });
  }
}

/** The single repository instance the app uses. */
export const notificationRepository: NotificationRepository = new AsyncStorageNotificationRepository();
