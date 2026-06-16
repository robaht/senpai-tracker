import { useMemo } from 'react';
import { useTrackingStore } from '../tracking/store';
import { WATCH_STATUSES, type TrackEntry, type WatchStatus } from '../tracking/types';

/**
 * Fallback episode length (minutes) used for the watch-time estimate when a
 * tracked entry has no `duration` — e.g. entries added before the snapshot
 * captured it. ~24 min is the standard TV episode. Estimates get exact as those
 * entries are updated and re-snapshot their real duration.
 */
export const FALLBACK_EPISODE_MINUTES = 24;

export interface Count<T extends string = string> {
  key: T;
  count: number;
}

export interface Stats {
  /** Number of tracked titles. */
  titles: number;
  /** Total episodes watched across the list (Σ progress). */
  episodes: number;
  /** Estimated watch time in whole hours (Σ progress × duration). */
  hours: number;
  /** Whether `hours` leaned on the fallback for any entry (i.e. it's an estimate). */
  hoursEstimated: boolean;
  /** Count per watch status, in canonical status order, zeros omitted. */
  perStatus: Count<WatchStatus>[];
  /** Top genres by frequency (descending), capped. */
  topGenres: Count[];
  /** Formats by frequency (descending). */
  formats: Count[];
  /** Mean of scored entries (0 when nothing is scored). */
  scoreMean: number;
  /** How many entries carry a score (> 0). */
  scoredCount: number;
  /** Count per integer score 1–10 (index 0 = score 1). */
  scoreDistribution: number[];
}

const MAX_GENRES = 8;

/** Derive the whole stats view from the tracked entries. Pure + offline. */
export function deriveStats(entries: TrackEntry[]): Stats {
  let episodes = 0;
  let minutes = 0;
  let hoursEstimated = false;

  const statusCounts = new Map<WatchStatus, number>();
  const genreCounts = new Map<string, number>();
  const formatCounts = new Map<string, number>();

  let scoreSum = 0;
  let scoredCount = 0;
  const scoreDistribution = new Array(10).fill(0) as number[];

  for (const e of entries) {
    episodes += e.progress;
    const perEp = e.duration ?? FALLBACK_EPISODE_MINUTES;
    if (e.duration == null && e.progress > 0) hoursEstimated = true;
    minutes += e.progress * perEp;

    statusCounts.set(e.status, (statusCounts.get(e.status) ?? 0) + 1);

    for (const g of e.genres ?? []) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }

    if (e.format) formatCounts.set(e.format, (formatCounts.get(e.format) ?? 0) + 1);

    if (e.score > 0) {
      scoreSum += e.score;
      scoredCount += 1;
      const idx = Math.min(10, Math.max(1, Math.round(e.score))) - 1;
      scoreDistribution[idx] += 1;
    }
  }

  const perStatus: Count<WatchStatus>[] = WATCH_STATUSES.filter(
    (s) => (statusCounts.get(s) ?? 0) > 0,
  ).map((s) => ({ key: s, count: statusCounts.get(s) as number }));

  const toSortedCounts = (m: Map<string, number>, cap?: number): Count[] => {
    const arr = [...m.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    return cap ? arr.slice(0, cap) : arr;
  };

  return {
    titles: entries.length,
    episodes,
    hours: Math.round(minutes / 60),
    hoursEstimated,
    perStatus,
    topGenres: toSortedCounts(genreCounts, MAX_GENRES),
    formats: toSortedCounts(formatCounts),
    scoreMean: scoredCount ? scoreSum / scoredCount : 0,
    scoredCount,
    scoreDistribution,
  };
}

/** Reactive stats derived from the in-memory tracking list. */
export function useStats(): Stats {
  const entries = useTrackingStore((s) => s.entries);
  return useMemo(() => deriveStats(Object.values(entries)), [entries]);
}
