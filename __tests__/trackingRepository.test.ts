import { AsyncStorageTrackingRepository, type KeyValueStore } from '../src/features/tracking/repository';
import { trackEntry } from './_fixtures';

/**
 * In-memory store whose getItem/setItem resolve on a later timer, so unguarded
 * read-modify-write cycles overlap (and lose data) — reproducing the F24 race.
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

describe('AsyncStorageTrackingRepository — serialized writes (F24)', () => {
  it('reproduces the lost-update race when read-modify-write is unguarded', async () => {
    // Two manual cycles on the same delayed store, run concurrently with no
    // serialization — exactly the pattern the old upsert used. One write is lost.
    const store = delayedStore();
    const cycle = async (patch: Record<string, number>) => {
      const map = JSON.parse((await store.getItem('k')) ?? '{}');
      Object.assign(map, patch);
      await store.setItem('k', JSON.stringify(map));
    };
    await Promise.all([cycle({ a: 1 }), cycle({ b: 2 })]);
    const final = JSON.parse((await store.getItem('k')) ?? '{}');
    expect(Object.keys(final)).toHaveLength(1); // data lost — this is the bug
  });

  it('does not lose concurrent upserts to different titles', async () => {
    const repo = new AsyncStorageTrackingRepository(delayedStore());
    await Promise.all(Array.from({ length: 10 }, (_, i) => repo.upsert(trackEntry(i + 1))));
    const ids = (await repo.getAll()).map((e) => e.mediaId).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('preserves operation order (remove after a concurrent upsert)', async () => {
    const repo = new AsyncStorageTrackingRepository(delayedStore());
    await Promise.all([repo.upsert(trackEntry(1)), repo.upsert(trackEntry(2)), repo.remove(1)]);
    expect((await repo.getAll()).map((e) => e.mediaId)).toEqual([2]);
  });

  it('replaceAll overwrites prior queued writes', async () => {
    const repo = new AsyncStorageTrackingRepository(delayedStore());
    await Promise.all([repo.upsert(trackEntry(1)), repo.replaceAll([trackEntry(5), trackEntry(6)])]);
    expect((await repo.getAll()).map((e) => e.mediaId).sort((a, b) => a - b)).toEqual([5, 6]);
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
    const repo = new AsyncStorageTrackingRepository(flaky);
    await expect(repo.upsert(trackEntry(1))).rejects.toThrow('boom');
    // A later op must still run despite the earlier rejection.
    await expect(repo.upsert(trackEntry(2))).resolves.toBeUndefined();
    expect(calls).toBe(2);
  });
});
