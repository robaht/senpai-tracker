import { isAiringRefreshCandidate, runAiringRefresh } from '../src/features/tracking/airingRefresh';
import { airedEpisodesFromMedia, behindCount, useTrackingStore } from '../src/features/tracking/store';
import { getMediaForDetection } from '../src/api/anilist';
import { media, trackEntry } from './_fixtures';

jest.mock('../src/api/anilist', () => ({ getMediaForDetection: jest.fn() }));
const mockedGetMedia = getMediaForDetection as jest.MockedFunction<typeof getMediaForDetection>;

const reset = () => useTrackingStore.setState({ entries: {}, hydrated: true });

describe('airedEpisodesFromMedia', () => {
  it('derives the latest released episode while airing', () => {
    const m = media(1, {
      status: 'RELEASING',
      nextAiringEpisode: { airingAt: 0, timeUntilAiring: 0, episode: 8 },
    });
    expect(airedEpisodesFromMedia(m)).toBe(7);
  });

  it('is null when not airing or the schedule is unknown', () => {
    expect(airedEpisodesFromMedia(media(1, { status: 'FINISHED' }))).toBeNull();
    expect(airedEpisodesFromMedia(media(1, { status: 'RELEASING', nextAiringEpisode: null }))).toBeNull();
  });
});

describe('isAiringRefreshCandidate', () => {
  it('includes never-snapshotted, upcoming, airing, and hiatus entries', () => {
    expect(isAiringRefreshCandidate(trackEntry(1))).toBe(true); // undefined = pre-feature entry
    expect(isAiringRefreshCandidate(trackEntry(1, { airingStatus: null }))).toBe(true);
    expect(isAiringRefreshCandidate(trackEntry(1, { airingStatus: 'NOT_YET_RELEASED' }))).toBe(true);
    expect(isAiringRefreshCandidate(trackEntry(1, { airingStatus: 'RELEASING' }))).toBe(true);
    expect(isAiringRefreshCandidate(trackEntry(1, { airingStatus: 'HIATUS' }))).toBe(true);
  });

  it('excludes terminal statuses', () => {
    expect(isAiringRefreshCandidate(trackEntry(1, { airingStatus: 'FINISHED' }))).toBe(false);
    expect(isAiringRefreshCandidate(trackEntry(1, { airingStatus: 'CANCELLED' }))).toBe(false);
  });
});

describe('behindCount', () => {
  it('counts aired-but-unwatched episodes while airing', () => {
    expect(behindCount(trackEntry(1, { airingStatus: 'RELEASING', airedEpisodes: 15, progress: 3 }))).toBe(12);
    expect(behindCount(trackEntry(1, { airingStatus: 'RELEASING', airedEpisodes: 15, progress: 15 }))).toBe(0);
  });

  it('is 0 when not airing, aired count unknown, or progress ahead of schedule', () => {
    expect(behindCount(trackEntry(1, { airingStatus: 'FINISHED', progress: 0, totalEpisodes: 12 }))).toBe(0);
    expect(behindCount(trackEntry(1, { airingStatus: 'RELEASING', airedEpisodes: null, progress: 0 }))).toBe(0);
    expect(behindCount(trackEntry(1, { airingStatus: 'RELEASING', airedEpisodes: 5, progress: 7 }))).toBe(0);
  });
});

describe('runAiringRefresh', () => {
  beforeEach(() => {
    reset();
    mockedGetMedia.mockReset();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('backfills a >50-entry library across multiple paced pages in one run', async () => {
    const entries: Record<number, ReturnType<typeof trackEntry>> = {};
    for (let id = 1; id <= 120; id++) entries[id] = trackEntry(id); // pre-feature: no airingStatus
    useTrackingStore.setState({ entries });
    mockedGetMedia.mockImplementation(async (ids) => ids.map((id) => media(id, { status: 'FINISHED' })));

    const run = runAiringRefresh({ force: true });
    await jest.runAllTimersAsync();
    const { refreshed } = await run;

    expect(refreshed).toBe(120);
    expect(mockedGetMedia).toHaveBeenCalledTimes(3); // 50 + 50 + 20
    expect(mockedGetMedia.mock.calls[2][0]).toHaveLength(20);
    expect(useTrackingStore.getState().entries[120]!.airingStatus).toBe('FINISHED');
  });

  it('keeps pages already applied when a later page fails', async () => {
    const entries: Record<number, ReturnType<typeof trackEntry>> = {};
    for (let id = 1; id <= 60; id++) entries[id] = trackEntry(id);
    useTrackingStore.setState({ entries });
    mockedGetMedia
      .mockImplementationOnce(async (ids) => ids.map((id) => media(id, { status: 'RELEASING' })))
      .mockRejectedValueOnce(new Error('429'));

    const run = runAiringRefresh({ force: true });
    await jest.runAllTimersAsync();
    const { refreshed } = await run;

    expect(refreshed).toBe(50);
    expect(useTrackingStore.getState().entries[1]!.airingStatus).toBe('RELEASING');
  });
});

describe('trackingStore.applyAiringRefresh', () => {
  beforeEach(reset);

  it('folds fresh airing state into matching entries without an updatedAt bump', () => {
    useTrackingStore.setState({
      entries: { 1: trackEntry(1, { status: 'PLANNING', airingStatus: 'NOT_YET_RELEASED', updatedAt: 1000 }) },
    });
    useTrackingStore.getState().applyAiringRefresh([
      media(1, {
        status: 'RELEASING',
        episodes: 13,
        nextAiringEpisode: { airingAt: 0, timeUntilAiring: 0, episode: 5 },
      }),
    ]);
    expect(useTrackingStore.getState().entries[1]).toMatchObject({
      airingStatus: 'RELEASING',
      airedEpisodes: 4,
      totalEpisodes: 13,
      premiereAt: null,
      updatedAt: 1000,
    });
  });

  it('ignores medias with no matching entry and preserves user fields', () => {
    useTrackingStore.setState({ entries: { 1: trackEntry(1, { progress: 6, score: 8 }) } });
    useTrackingStore.getState().applyAiringRefresh([media(2, { status: 'RELEASING' })]);
    expect(useTrackingStore.getState().entries[2]).toBeUndefined();

    useTrackingStore.getState().applyAiringRefresh([media(1, { status: 'RELEASING' })]);
    expect(useTrackingStore.getState().entries[1]).toMatchObject({ progress: 6, score: 8, airingStatus: 'RELEASING' });
  });

  it('keeps the known episode total when AniList has none', () => {
    useTrackingStore.setState({ entries: { 1: trackEntry(1, { totalEpisodes: 12 }) } });
    useTrackingStore.getState().applyAiringRefresh([media(1, { status: 'RELEASING', episodes: null })]);
    expect(useTrackingStore.getState().entries[1]!.totalEpisodes).toBe(12);
  });
});
