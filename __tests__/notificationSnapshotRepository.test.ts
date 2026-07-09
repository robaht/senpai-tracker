import {
  AsyncStorageSnapshotRepository,
  type KeyValueStore,
} from '../src/features/notifications/snapshotRepository';
import { snapshot } from './_fixtures';

/**
 * Same delayed-store harness as `trackingRepository.test.ts` /
 * `notificationRepository.test.ts` — reproduces the F24-class lost-update race
 * for unguarded read-modify-write cycles, to prove the serial queue prevents it
 * here too.
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

describe('AsyncStorageSnapshotRepository — serialized writes', () => {
  it('does not lose concurrent upserts to different titles', async () => {
    const repo = new AsyncStorageSnapshotRepository(delayedStore());
    await Promise.all(Array.from({ length: 10 }, (_, i) => repo.upsert(snapshot(i + 1))));
    const ids = (await repo.getAll()).map((s) => s.mediaId).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('preserves operation order (remove after a concurrent upsert)', async () => {
    const repo = new AsyncStorageSnapshotRepository(delayedStore());
    await Promise.all([repo.upsert(snapshot(1)), repo.upsert(snapshot(2)), repo.remove(1)]);
    expect((await repo.getAll()).map((s) => s.mediaId)).toEqual([2]);
  });

  it('a concurrent upsert is visible to a subsequent get()', async () => {
    const repo = new AsyncStorageSnapshotRepository(delayedStore());
    const [, , fetched] = await Promise.all([
      repo.upsert(snapshot(1, { releasedEpisodes: 3 })),
      repo.upsert(snapshot(2, { releasedEpisodes: 7 })),
      repo.get(2),
    ]);
    // `get(2)` was enqueued after both upserts above (declared last), so it
    // must observe the fully-settled state, not an interleaved partial write.
    expect(fetched).toMatchObject({ mediaId: 2, releasedEpisodes: 7 });
  });

  it('keeps the queue alive after a failed write', async () => {
    let calls = 0;
    const flaky: KeyValueStore = {
      async getItem() {
        return null;
      },
      async setItem() {
        calls += 1;
        if (calls === 1) throw new Error('boom');
      },
    };
    const repo = new AsyncStorageSnapshotRepository(flaky);
    await expect(repo.upsert(snapshot(1))).rejects.toThrow('boom');
    await expect(repo.upsert(snapshot(2))).resolves.toBeUndefined();
    expect(calls).toBe(2);
  });

  it('get() returns null for a title with no stored snapshot', async () => {
    const repo = new AsyncStorageSnapshotRepository(delayedStore());
    await repo.upsert(snapshot(1));
    expect(await repo.get(999)).toBeNull();
  });
});
