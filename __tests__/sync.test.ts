import { reconcile, toRemoteScore, remoteToTrackEntry } from '../src/features/tracking/sync';
import type { MyListEntry } from '../src/api/anilist';
import { media, trackEntry } from './_fixtures';

const find = <T extends { mediaId: number }>(list: T[], id: number): T | undefined =>
  list.find((e) => e.mediaId === id);

describe('reconcile', () => {
  it('keeps a remote-only entry without pushing it', () => {
    const remote = [trackEntry(1, { remoteId: 11, updatedAt: 5000 })];
    const { merged, toPush } = reconcile([], remote);
    expect(find(merged, 1)?.remoteId).toBe(11);
    expect(toPush).toHaveLength(0);
  });

  it('keeps a local-only entry and queues it for upload', () => {
    const local = [trackEntry(2, { updatedAt: 5000 })];
    const { merged, toPush } = reconcile(local, []);
    expect(find(merged, 2)).toBeTruthy();
    expect(toPush.map((e) => e.mediaId)).toEqual([2]);
  });

  it('local-newer wins, keeps the remote remoteId, and is pushed', () => {
    const local = [trackEntry(3, { updatedAt: 9000, progress: 12 })];
    const remote = [trackEntry(3, { remoteId: 33, updatedAt: 1000, progress: 1 })];
    const { merged, toPush } = reconcile(local, remote);
    const m = find(merged, 3)!;
    expect(m.progress).toBe(12);
    expect(m.remoteId).toBe(33);
    expect(toPush.map((e) => e.mediaId)).toEqual([3]);
  });

  it('remote-newer wins and is not pushed; createdAt is the earliest', () => {
    const local = [trackEntry(4, { updatedAt: 1000, progress: 1, createdAt: 100 })];
    const remote = [trackEntry(4, { remoteId: 44, updatedAt: 9000, progress: 9, createdAt: 500 })];
    const { merged, toPush } = reconcile(local, remote);
    const m = find(merged, 4)!;
    expect(m.progress).toBe(9);
    expect(m.createdAt).toBe(100);
    expect(toPush).toHaveLength(0);
  });

  it('treats equal timestamps as remote-wins (no push)', () => {
    const local = [trackEntry(5, { updatedAt: 5000, progress: 1 })];
    const remote = [trackEntry(5, { remoteId: 55, updatedAt: 5000, progress: 7 })];
    const { merged, toPush } = reconcile(local, remote);
    expect(find(merged, 5)?.progress).toBe(7);
    expect(toPush).toHaveLength(0);
  });
});

describe('toRemoteScore', () => {
  it('converts internal POINT_10 to each AniList score format', () => {
    expect(toRemoteScore(8, 'POINT_100')).toBe(80);
    expect(toRemoteScore(8, 'POINT_10')).toBe(8);
    expect(toRemoteScore(8, 'POINT_10_DECIMAL')).toBe(8);
    expect(toRemoteScore(8, 'POINT_5')).toBe(4);
    expect(toRemoteScore(8, 'POINT_3')).toBe(3);
    expect(toRemoteScore(2, 'POINT_3')).toBe(1);
    expect(toRemoteScore(0, 'POINT_3')).toBe(0);
  });
});

describe('remoteToTrackEntry', () => {
  it('maps a pulled entry to a TrackEntry with remoteId and clamped score', () => {
    const entry: MyListEntry = {
      media: media(7, { genres: ['Action', 'Drama'] }),
      remoteId: 77,
      status: 'COMPLETED',
      progress: 24,
      score: 12, // out of range — clamped
      updatedAt: 1700000000000,
      createdAt: 1600000000000,
    };
    const t = remoteToTrackEntry(entry);
    expect(t).toMatchObject({
      mediaId: 7,
      remoteId: 77,
      status: 'COMPLETED',
      progress: 24,
      score: 10,
      title: 'Title 7',
      genres: ['Action', 'Drama'],
      updatedAt: 1700000000000,
      createdAt: 1600000000000,
    });
  });
});
