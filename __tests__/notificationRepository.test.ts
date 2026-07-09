import {
  AsyncStorageNotificationRepository,
  type KeyValueStore,
} from '../src/features/notifications/repository';
import { notification } from './_fixtures';
import type { AppNotification } from '../src/features/notifications/types';

/**
 * In-memory store whose getItem/setItem resolve on a later timer, so unguarded
 * read-modify-write cycles overlap (and lose data) — same harness as
 * `trackingRepository.test.ts`'s F24 race reproduction, applied here.
 */
function delayedStore(delay = 2): KeyValueStore {
  let value: string | null = null;
  const wait = () => new Promise<void>((r) => setTimeout(r, delay));
  return {
    async getItem() {
      await wait();
      return value;
    },
    async setItem(_key, v) {
      await wait();
      value = v;
    },
  };
}

/** Plain in-memory store, no artificial delay — for the cap/trim tests. */
function memoryStore(): KeyValueStore {
  let value: string | null = null;
  return {
    async getItem() {
      return value;
    },
    async setItem(_key, v) {
      value = v;
    },
  };
}

describe('AsyncStorageNotificationRepository — serialized writes', () => {
  it('does not lose concurrent upserts to different notifications', async () => {
    const repo = new AsyncStorageNotificationRepository(delayedStore());
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => repo.upsert(notification(`n${i + 1}`, { mediaId: i + 1 }))),
    );
    const ids = (await repo.getAll()).map((n) => n.id).sort();
    expect(ids).toEqual(Array.from({ length: 10 }, (_, i) => `n${i + 1}`).sort());
  });

  it('preserves operation order (remove after a concurrent upsert)', async () => {
    const repo = new AsyncStorageNotificationRepository(delayedStore());
    await Promise.all([
      repo.upsert(notification('n1', { mediaId: 1 })),
      repo.upsert(notification('n2', { mediaId: 2 })),
      repo.remove('n1'),
    ]);
    expect((await repo.getAll()).map((n) => n.id)).toEqual(['n2']);
  });

  it('replaceAll overwrites prior queued writes', async () => {
    const repo = new AsyncStorageNotificationRepository(delayedStore());
    await Promise.all([
      repo.upsert(notification('stale', { mediaId: 1 })),
      repo.replaceAll([notification('n5', { mediaId: 5 }), notification('n6', { mediaId: 6 })]),
    ]);
    expect((await repo.getAll()).map((n) => n.id).sort()).toEqual(['n5', 'n6']);
  });

  it('keeps the queue alive after a failed write', async () => {
    let calls = 0;
    const flaky: KeyValueStore = {
      async getItem() {
        return null;
      },
      async setItem() {
        calls += 1;
        if (calls === 1) throw new Error('boom'); // first write fails
      },
    };
    const repo = new AsyncStorageNotificationRepository(flaky);
    await expect(repo.upsert(notification('n1'))).rejects.toThrow('boom');
    // A later op must still run despite the earlier rejection.
    await expect(repo.upsert(notification('n2'))).resolves.toBeUndefined();
    expect(calls).toBe(2);
  });
});

describe('AsyncStorageNotificationRepository — 200-row cap (drop-oldest-read policy)', () => {
  it('drops the oldest read notifications first once the list exceeds 200', async () => {
    const repo = new AsyncStorageNotificationRepository(memoryStore());
    const list: AppNotification[] = [];
    for (let i = 0; i < 210; i++) {
      list.push(notification(`read:${i}`, { read: true, createdAt: i, mediaId: i }));
    }
    await repo.replaceAll(list);
    const all = await repo.getAll();
    expect(all).toHaveLength(200);
    const ids = new Set(all.map((n) => n.id));
    // The 10 oldest (lowest createdAt) reads should have been dropped.
    for (let i = 0; i < 10; i++) expect(ids.has(`read:${i}`)).toBe(false);
    for (let i = 10; i < 210; i++) expect(ids.has(`read:${i}`)).toBe(true);
  });

  it('never drops unread notifications, even when that leaves the list over the cap', async () => {
    const repo = new AsyncStorageNotificationRepository(memoryStore());
    const list: AppNotification[] = [];
    for (let i = 0; i < 210; i++) {
      list.push(notification(`unread:${i}`, { read: false, createdAt: i, mediaId: i }));
    }
    await repo.replaceAll(list);
    const all = await repo.getAll();
    // No read rows exist to drop — the repo stays over-cap rather than
    // discarding anything the user hasn't seen yet.
    expect(all).toHaveLength(210);
  });

  it('drops only the oldest reads when read and unread rows are interleaved', async () => {
    const repo = new AsyncStorageNotificationRepository(memoryStore());
    const list: AppNotification[] = [];
    // 195 unread (never eligible for trimming).
    for (let i = 0; i < 195; i++) {
      list.push(notification(`u:${i}`, { read: false, createdAt: 1000 + i, mediaId: i }));
    }
    // 20 read, oldest createdAt of the whole list — these are the trim candidates.
    for (let i = 0; i < 20; i++) {
      list.push(notification(`r:${i}`, { read: true, createdAt: i, mediaId: 1000 + i }));
    }
    await repo.replaceAll(list);
    const all = await repo.getAll();
    expect(all).toHaveLength(200); // 195 unread + 5 surviving reads
    const unreadRemaining = all.filter((n) => !n.read);
    expect(unreadRemaining).toHaveLength(195); // none of the unread rows were touched
    const readRemaining = all.filter((n) => n.read).map((n) => n.id).sort();
    // The 5 newest reads (r:15..r:19) should survive; r:0..r:14 are dropped.
    expect(readRemaining).toEqual(['r:15', 'r:16', 'r:17', 'r:18', 'r:19']);
  });

  it('applies the cap incrementally across individual upserts, not just replaceAll', async () => {
    const repo = new AsyncStorageNotificationRepository(memoryStore());
    for (let i = 0; i < 205; i++) {
      await repo.upsert(notification(`n:${i}`, { read: true, createdAt: i, mediaId: i }));
    }
    const all = await repo.getAll();
    expect(all).toHaveLength(200);
    expect(all.map((n) => n.id)).not.toContain('n:0');
  });
});
