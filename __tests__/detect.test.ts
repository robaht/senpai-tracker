import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAnimeById } from '../src/api/anilist';
import { runNotificationDetection } from '../src/features/notifications/detect';
import { snapshotRepository } from '../src/features/notifications/snapshotRepository';
import { useNotificationStore } from '../src/features/notifications/store';
import { useTrackingStore } from '../src/features/tracking/store';
import { media, relationEdge, trackEntry } from './_fixtures';

// Only `getAnimeById` needs to be a mock/spy — keep everything else (e.g.
// `displayTitle`) real, since `detect.ts` relies on it to resolve titles.
jest.mock('../src/api/anilist', () => {
  const actual = jest.requireActual('../src/api/anilist');
  return { ...actual, getAnimeById: jest.fn() };
});

const mockGetAnimeById = getAnimeById as jest.MockedFunction<typeof getAnimeById>;

const airing = (episode: number) => ({ airingAt: 0, timeUntilAiring: 0, episode });

async function reset() {
  await AsyncStorage.clear();
  useNotificationStore.setState({ entries: {}, hydrated: true });
  useTrackingStore.setState({ entries: {}, hydrated: true });
  mockGetAnimeById.mockReset();
}

beforeEach(reset);

describe('runNotificationDetection — first-run baselining (AC 6, 7)', () => {
  it('emits nothing on the very first check for a title, only baselines the snapshot', async () => {
    useTrackingStore.setState({
      entries: { 1: trackEntry(1, { mediaId: 1, status: 'CURRENT' }) },
      hydrated: true,
    });
    mockGetAnimeById.mockResolvedValue(media(1, { episodes: null, nextAiringEpisode: airing(6) })); // releasedEpisodes = 5

    const result = await runNotificationDetection({ force: true });

    expect(result.added).toBe(0);
    expect(Object.keys(useNotificationStore.getState().entries)).toHaveLength(0);
    const snap = await snapshotRepository.get(1);
    expect(snap).toMatchObject({ mediaId: 1, releasedEpisodes: 5, initialized: true });
  });

  it('a subsequent run, after new data appears, produces the notification', async () => {
    useTrackingStore.setState({
      entries: { 1: trackEntry(1, { mediaId: 1, status: 'CURRENT' }) },
      hydrated: true,
    });
    mockGetAnimeById.mockResolvedValue(media(1, { episodes: null, nextAiringEpisode: airing(6) })); // released 5
    const first = await runNotificationDetection({ force: true });
    expect(first.added).toBe(0);

    mockGetAnimeById.mockResolvedValue(media(1, { episodes: null, nextAiringEpisode: airing(8) })); // released 7
    const second = await runNotificationDetection({ force: true });

    expect(second.added).toBe(1);
    const entries = Object.values(useNotificationStore.getState().entries);
    expect(entries).toMatchObject([{ type: 'new-episode', mediaId: 1, episode: 7, episodeCount: 2 }]);
  });

  it('baselines a nonzero sequel list silently too (no new-season flood on first run)', async () => {
    useTrackingStore.setState({
      entries: { 1: trackEntry(1, { mediaId: 1, status: 'COMPLETED' }) },
      hydrated: true,
    });
    mockGetAnimeById.mockResolvedValue(
      media(1, {
        episodes: 12,
        relations: [relationEdge('SEQUEL', { id: 99, title: { romaji: 'Season 2', english: null, native: null } })],
      }),
    );

    const result = await runNotificationDetection({ force: true });

    expect(result.added).toBe(0);
    expect(Object.keys(useNotificationStore.getState().entries)).toHaveLength(0);
    const snap = await snapshotRepository.get(1);
    expect(snap).toMatchObject({ knownSequelIds: [99], initialized: true });
  });
});

describe('runNotificationDetection — dedupe / idempotent re-run (AC 6)', () => {
  it('running detection twice with no underlying data change adds nothing the second time', async () => {
    useTrackingStore.setState({
      entries: { 1: trackEntry(1, { mediaId: 1, status: 'CURRENT' }) },
      hydrated: true,
    });
    await snapshotRepository.upsert({ mediaId: 1, releasedEpisodes: 5, knownSequelIds: [], initialized: true, lastCheckedAt: 1 });
    mockGetAnimeById.mockResolvedValue(media(1, { episodes: null, nextAiringEpisode: airing(8) })); // released 7

    const first = await runNotificationDetection({ force: true });
    expect(first.added).toBe(1);

    const second = await runNotificationDetection({ force: true }); // same fetch result, no data change
    expect(second.added).toBe(0);
    expect(Object.keys(useNotificationStore.getState().entries)).toHaveLength(1);
  });

  it('store.add itself no-ops a duplicate dedupe id even called directly', () => {
    useNotificationStore.setState({ entries: {}, hydrated: true });
    const n = {
      id: 'new-episode:1:7',
      type: 'new-episode' as const,
      mediaId: 1,
      title: 'Title 1',
      coverImage: null,
      message: 'Episode 7 is out',
      episode: 7,
      episodeCount: 1,
      createdAt: 1,
      read: false,
    };
    useNotificationStore.getState().add(n);
    useNotificationStore.getState().add({ ...n, message: 'different message, same id' });
    const entries = Object.values(useNotificationStore.getState().entries);
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('Episode 7 is out');
  });
});

describe('runNotificationDetection — 15-minute throttle (AC 12)', () => {
  it('a second non-forced call within the window makes no further getAnimeById calls', async () => {
    useTrackingStore.setState({
      entries: { 1: trackEntry(1, { mediaId: 1, status: 'CURRENT' }) },
      hydrated: true,
    });
    mockGetAnimeById.mockResolvedValue(media(1));

    const first = await runNotificationDetection();
    expect(mockGetAnimeById).toHaveBeenCalledTimes(1);
    expect(first.added).toBe(0); // first-ever check baselines silently anyway

    const second = await runNotificationDetection();
    expect(second).toEqual({ added: 0 });
    expect(mockGetAnimeById).toHaveBeenCalledTimes(1); // no additional network call
  });

  it('force bypasses the throttle', async () => {
    useTrackingStore.setState({
      entries: { 1: trackEntry(1, { mediaId: 1, status: 'CURRENT' }) },
      hydrated: true,
    });
    mockGetAnimeById.mockResolvedValue(media(1));

    await runNotificationDetection();
    expect(mockGetAnimeById).toHaveBeenCalledTimes(1);

    await runNotificationDetection({ force: true });
    expect(mockGetAnimeById).toHaveBeenCalledTimes(2);
  });
});

describe('runNotificationDetection — new-episode detection math', () => {
  it('computes releasedEpisodes from nextAiringEpisode.episode - 1 while airing', async () => {
    useTrackingStore.setState({
      entries: { 1: trackEntry(1, { mediaId: 1, status: 'CURRENT' }) },
      hydrated: true,
    });
    await snapshotRepository.upsert({ mediaId: 1, releasedEpisodes: 3, knownSequelIds: [], initialized: true, lastCheckedAt: 1 });
    mockGetAnimeById.mockResolvedValue(media(1, { episodes: null, nextAiringEpisode: airing(5) })); // released = 4

    const result = await runNotificationDetection({ force: true });

    expect(result.added).toBe(1);
    const n = Object.values(useNotificationStore.getState().entries)[0];
    expect(n).toMatchObject({ episode: 4, episodeCount: 1, message: 'Episode 4 is out', id: 'new-episode:1:4' });
  });

  it('falls back to media.episodes when nothing is airing (finished title)', async () => {
    useTrackingStore.setState({
      entries: { 1: trackEntry(1, { mediaId: 1, status: 'CURRENT' }) },
      hydrated: true,
    });
    await snapshotRepository.upsert({ mediaId: 1, releasedEpisodes: 10, knownSequelIds: [], initialized: true, lastCheckedAt: 1 });
    mockGetAnimeById.mockResolvedValue(media(1, { episodes: 12, nextAiringEpisode: null }));

    const result = await runNotificationDetection({ force: true });

    expect(result.added).toBe(1);
    const n = Object.values(useNotificationStore.getState().entries)[0];
    expect(n).toMatchObject({ episode: 12, episodeCount: 2, message: '2 new episodes are out' });
  });

  it('treats a null media.episodes as zero released episodes when not airing', async () => {
    useTrackingStore.setState({
      entries: { 1: trackEntry(1, { mediaId: 1, status: 'CURRENT' }) },
      hydrated: true,
    });
    await snapshotRepository.upsert({ mediaId: 1, releasedEpisodes: 0, knownSequelIds: [], initialized: true, lastCheckedAt: 1 });
    mockGetAnimeById.mockResolvedValue(media(1, { episodes: null, nextAiringEpisode: null }));

    const result = await runNotificationDetection({ force: true });
    expect(result.added).toBe(0); // 0 > 0 is false, no notification
  });

  it('does not emit a new-episode notification for a COMPLETED (season-only-candidate) title', async () => {
    useTrackingStore.setState({
      entries: { 1: trackEntry(1, { mediaId: 1, status: 'COMPLETED' }) },
      hydrated: true,
    });
    await snapshotRepository.upsert({ mediaId: 1, releasedEpisodes: 10, knownSequelIds: [], initialized: true, lastCheckedAt: 1 });
    mockGetAnimeById.mockResolvedValue(media(1, { episodes: 12, nextAiringEpisode: null }));

    const result = await runNotificationDetection({ force: true });
    expect(result.added).toBe(0);
  });
});

describe('runNotificationDetection — new-season detection', () => {
  it('emits one new-season notification per newly discovered SEQUEL not in knownSequelIds', async () => {
    useTrackingStore.setState({
      entries: { 1: trackEntry(1, { mediaId: 1, status: 'COMPLETED' }) },
      hydrated: true,
    });
    await snapshotRepository.upsert({ mediaId: 1, releasedEpisodes: 12, knownSequelIds: [], initialized: true, lastCheckedAt: 1 });
    mockGetAnimeById.mockResolvedValue(
      media(1, {
        episodes: 12,
        relations: [relationEdge('SEQUEL', { id: 99, title: { romaji: 'Season 2', english: null, native: null } })],
      }),
    );

    const result = await runNotificationDetection({ force: true });

    expect(result.added).toBe(1);
    const n = Object.values(useNotificationStore.getState().entries)[0];
    expect(n).toMatchObject({
      type: 'new-season',
      mediaId: 1,
      sequelMediaId: 99,
      sequelTitle: 'Season 2',
      id: 'new-season:1:99',
    });
  });

  it('does not re-emit for a sequel already present in knownSequelIds', async () => {
    useTrackingStore.setState({
      entries: { 1: trackEntry(1, { mediaId: 1, status: 'COMPLETED' }) },
      hydrated: true,
    });
    await snapshotRepository.upsert({ mediaId: 1, releasedEpisodes: 12, knownSequelIds: [99], initialized: true, lastCheckedAt: 1 });
    mockGetAnimeById.mockResolvedValue(
      media(1, {
        episodes: 12,
        relations: [relationEdge('SEQUEL', { id: 99, title: { romaji: 'Season 2', english: null, native: null } })],
      }),
    );

    const result = await runNotificationDetection({ force: true });
    expect(result.added).toBe(0);
  });

  it('ignores non-SEQUEL relations (e.g. PREQUEL) entirely', async () => {
    useTrackingStore.setState({
      entries: { 1: trackEntry(1, { mediaId: 1, status: 'COMPLETED' }) },
      hydrated: true,
    });
    await snapshotRepository.upsert({ mediaId: 1, releasedEpisodes: 12, knownSequelIds: [], initialized: true, lastCheckedAt: 1 });
    mockGetAnimeById.mockResolvedValue(
      media(1, {
        episodes: 12,
        relations: [relationEdge('PREQUEL', { id: 50, title: { romaji: 'Season 0', english: null, native: null } })],
      }),
    );

    const result = await runNotificationDetection({ force: true });
    expect(result.added).toBe(0);
    const snap = await snapshotRepository.get(1);
    expect(snap?.knownSequelIds).toEqual([]);
  });

  it('does not emit a new-season notification for a CURRENT (episode-only-candidate) title', async () => {
    useTrackingStore.setState({
      entries: { 1: trackEntry(1, { mediaId: 1, status: 'CURRENT' }) },
      hydrated: true,
    });
    await snapshotRepository.upsert({ mediaId: 1, releasedEpisodes: 12, knownSequelIds: [], initialized: true, lastCheckedAt: 1 });
    mockGetAnimeById.mockResolvedValue(
      media(1, {
        episodes: 12,
        nextAiringEpisode: null,
        relations: [relationEdge('SEQUEL', { id: 99, title: { romaji: 'Season 2', english: null, native: null } })],
      }),
    );

    const result = await runNotificationDetection({ force: true });
    expect(result.added).toBe(0);
    // snapshot still records the sequel id for later use, even though it
    // wasn't a season candidate this run.
    const snap = await snapshotRepository.get(1);
    expect(snap?.knownSequelIds).toEqual([99]);
  });
});

describe('runNotificationDetection — candidate id split by tracking status', () => {
  it('builds episodeCandidates from CURRENT/REPEATING/PAUSED and seasonCandidates from COMPLETED, skipping PLANNING/DROPPED', async () => {
    useTrackingStore.setState({
      entries: {
        1: trackEntry(1, { mediaId: 1, status: 'CURRENT' }),
        2: trackEntry(2, { mediaId: 2, status: 'PLANNING' }),
        3: trackEntry(3, { mediaId: 3, status: 'DROPPED' }),
        4: trackEntry(4, { mediaId: 4, status: 'COMPLETED' }),
        5: trackEntry(5, { mediaId: 5, status: 'REPEATING' }),
        6: trackEntry(6, { mediaId: 6, status: 'PAUSED' }),
      },
      hydrated: true,
    });
    mockGetAnimeById.mockImplementation(async (id: number) => media(id));

    await runNotificationDetection({ force: true });

    const calledIds = mockGetAnimeById.mock.calls.map((c) => c[0]).sort((a, b) => a - b);
    expect(calledIds).toEqual([1, 4, 5, 6]);
  });
});

describe('runNotificationDetection — 40-id fan-out cap, oldest-checked-first', () => {
  it('selects the 40 ids with the oldest lastCheckedAt (no-snapshot ids sort first)', async () => {
    const entries: Record<number, ReturnType<typeof trackEntry>> = {};
    for (let i = 1; i <= 45; i++) entries[i] = trackEntry(i, { mediaId: i, status: 'CURRENT' });
    useTrackingStore.setState({ entries, hydrated: true });

    // ids 1..5 already have a recent snapshot -> should sort last, excluded
    // from this run's 40-id cap. ids 6..45 (40 ids) have no snapshot yet.
    for (let i = 1; i <= 5; i++) {
      await snapshotRepository.upsert({
        mediaId: i,
        releasedEpisodes: 0,
        knownSequelIds: [],
        initialized: true,
        lastCheckedAt: Date.now(),
      });
    }
    mockGetAnimeById.mockImplementation(async (id: number) => media(id));

    await runNotificationDetection({ force: true });

    const calledIds = mockGetAnimeById.mock.calls.map((c) => c[0]).sort((a, b) => a - b);
    expect(calledIds).toHaveLength(40);
    expect(calledIds).toEqual(Array.from({ length: 40 }, (_, i) => i + 6));
  });
});

describe('runNotificationDetection — per-id fetch failures', () => {
  it('skips a failing id and still processes the rest of the batch', async () => {
    useTrackingStore.setState({
      entries: {
        1: trackEntry(1, { mediaId: 1, status: 'CURRENT' }),
        2: trackEntry(2, { mediaId: 2, status: 'CURRENT' }),
      },
      hydrated: true,
    });
    await snapshotRepository.upsert({ mediaId: 1, releasedEpisodes: 1, knownSequelIds: [], initialized: true, lastCheckedAt: 1 });
    await snapshotRepository.upsert({ mediaId: 2, releasedEpisodes: 1, knownSequelIds: [], initialized: true, lastCheckedAt: 1 });

    mockGetAnimeById.mockImplementation(async (id: number) => {
      if (id === 1) throw new Error('network error');
      return media(2, { episodes: null, nextAiringEpisode: airing(4) }); // released 3
    });

    const result = await runNotificationDetection({ force: true });

    expect(result.added).toBe(1);
    const entries = Object.values(useNotificationStore.getState().entries);
    expect(entries).toMatchObject([{ mediaId: 2 }]);
    // The failing id's snapshot must be untouched (no baseline write on error).
    const snap1 = await snapshotRepository.get(1);
    expect(snap1).toMatchObject({ releasedEpisodes: 1 });
  });
});
