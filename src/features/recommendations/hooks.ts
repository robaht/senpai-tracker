import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { animeKeys } from '../../api/anilist/hooks';
import { getRecommendations } from '../../api/anilist';
import type { Media } from '../../api/anilist';
import { useTrackingStore } from '../tracking/store';
import type { TrackEntry, WatchStatus } from '../tracking/types';
import { useDismissedStore } from './store';
import { computeAffinity, matchScore } from './affinity';

/** A ranked For You pick: the title, why it fits, and what seeded it. */
export interface ForYouItem {
  media: Media;
  /** 0–100 taste match, or null when there's no profile to judge against. */
  match: number | null;
  /** Genres the user leans toward that this title has — the "because" line. */
  reasons: string[];
  /** The tracked title that most strongly recommended this one. */
  becauseOf: string;
}

/** A title recommended by *both* blend inputs, with its taste match. */
export interface BlendItem {
  media: Media;
  match: number | null;
}

/**
 * "Blend" two titles: the anime that the recommendation graphs of *both* inputs
 * point to — the sweet spot between two things the user loves. Ranks by the
 * combined community rating, drops anything already tracked or dismissed, and
 * attaches a taste match for display.
 */
export function useBlend(
  idA: number | null,
  idB: number | null,
): { items: BlendItem[]; isLoading: boolean } {
  const entries = useTrackingStore((s) => s.entries);
  const dismissed = useDismissedStore((s) => s.ids);

  const results = useQueries({
    queries: [idA, idB].map((id) => ({
      queryKey: animeKeys.recommendations(id ?? 0),
      queryFn: () => getRecommendations(id as number),
      enabled: !!id && id > 0,
      staleTime: 60 * 60 * 1000,
    })),
  });

  const list = useMemo(() => Object.values(entries), [entries]);
  const affinity = useMemo(() => computeAffinity(list), [list]);
  const tracked = useMemo(() => new Set(list.map((e) => e.mediaId)), [list]);

  const items = useMemo<BlendItem[]>(() => {
    const [ra, rb] = results;
    if (!ra?.data || !rb?.data) return [];
    const ratingB = new Map(rb.data.map((r) => [r.media.id, r.rating]));
    const out: { media: Media; match: number | null; rating: number }[] = [];
    for (const r of ra.data) {
      const id = r.media.id;
      if (!ratingB.has(id)) continue; // must be recommended by BOTH inputs
      if (tracked.has(id) || dismissed.has(id) || id === idA || id === idB) continue;
      out.push({
        media: r.media,
        match: matchScore(r.media, affinity).score,
        rating: r.rating + (ratingB.get(id) ?? 0),
      });
    }
    return out
      .sort((a, b) => b.rating - a.rating)
      .map(({ media, match }) => ({ media, match }));
  }, [results, tracked, dismissed, affinity, idA, idB]);

  return { items, isLoading: results.some((r) => r.isLoading && r.fetchStatus !== 'idle') };
}

/**
 * How strongly each status seeds recommendations. Titles you've watched lead,
 * but Plan-to-Watch and On-hold still count — they're a real taste signal, and
 * excluding them left users with plan-to-watch-heavy lists seeing nothing.
 * Dropped is deliberately omitted (it's a negative signal handled in affinity).
 */
const SOURCE_STATUS: Partial<Record<WatchStatus, number>> = {
  REPEATING: 2.5,
  COMPLETED: 2,
  CURRENT: 1.5,
  PAUSED: 1,
  PLANNING: 1,
};

/** How much a tracked title should drive recommendations. */
function sourceLove(entry: TrackEntry): number {
  const base = SOURCE_STATUS[entry.status];
  if (base === undefined) return 0;
  return base * (entry.score > 0 ? entry.score / 6 : 1);
}

/** How many tracked titles we fan out over — caps requests for the rate limit. */
const MAX_SOURCES = 12;

/**
 * The For You engine. Picks the user's most-loved tracked titles, fetches
 * AniList recommendations for each (cached per-title, shared with the detail
 * rail), tallies candidates by how strongly they're recommended × how much the
 * source is loved, drops anything already tracked or dismissed, and ranks the
 * survivors with a taste-match nudge. All four gimmicks read from this.
 */
export function useForYou(): {
  items: ForYouItem[];
  isLoading: boolean;
  isError: boolean;
} {
  const entries = useTrackingStore((s) => s.entries);
  const dismissed = useDismissedStore((s) => s.ids);

  const list = useMemo(() => Object.values(entries), [entries]);

  // The seed titles, most-loved first.
  const sources = useMemo(() => {
    return list
      .map((e) => ({ entry: e, love: sourceLove(e) }))
      .filter((s) => s.love > 0)
      .sort((a, b) => b.love - a.love)
      .slice(0, MAX_SOURCES);
  }, [list]);

  const affinity = useMemo(() => computeAffinity(list), [list]);

  const results = useQueries({
    queries: sources.map((s) => ({
      queryKey: animeKeys.recommendations(s.entry.mediaId),
      queryFn: () => getRecommendations(s.entry.mediaId),
      staleTime: 60 * 60 * 1000,
    })),
  });

  const tracked = useMemo(() => new Set(list.map((e) => e.mediaId)), [list]);

  const items = useMemo<ForYouItem[]>(() => {
    interface Agg {
      media: Media;
      weight: number;
      becauseOf: string;
      bestContribution: number;
    }
    const agg = new Map<number, Agg>();

    results.forEach((res, i) => {
      const recs = res.data;
      if (!recs) return;
      const source = sources[i];
      const sourceTitle = source.entry.title;
      for (const rec of recs) {
        const id = rec.media.id;
        if (tracked.has(id) || dismissed.has(id)) continue;
        // Dampen raw vote counts; weight by how much we love the source.
        const contribution = source.love * Math.log1p(Math.max(0, rec.rating));
        const existing = agg.get(id);
        if (existing) {
          existing.weight += contribution;
          if (contribution > existing.bestContribution) {
            existing.bestContribution = contribution;
            existing.becauseOf = sourceTitle;
          }
        } else {
          agg.set(id, {
            media: rec.media,
            weight: contribution,
            becauseOf: sourceTitle,
            bestContribution: contribution,
          });
        }
      }
    });

    return [...agg.values()]
      .map((a) => {
        const { score, reasons } = matchScore(a.media, affinity);
        // Nudge by taste match: a perfect match keeps full weight, a poor one
        // is halved — community signal still leads.
        const matchFactor = score === null ? 1 : 0.6 + (0.4 * score) / 100;
        return {
          item: {
            media: a.media,
            match: score,
            reasons,
            becauseOf: a.becauseOf,
          } satisfies ForYouItem,
          rank: a.weight * matchFactor,
        };
      })
      .sort((a, b) => b.rank - a.rank)
      .map((x) => x.item);
  }, [results, sources, tracked, dismissed, affinity]);

  return {
    items,
    isLoading: results.some((r) => r.isLoading),
    isError: results.length > 0 && results.every((r) => r.isError),
  };
}
