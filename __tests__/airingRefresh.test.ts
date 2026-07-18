import { isAiringRefreshCandidate } from '../src/features/tracking/airingRefresh';
import { airedEpisodesFromMedia, useTrackingStore } from '../src/features/tracking/store';
import { media, trackEntry } from './_fixtures';

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
