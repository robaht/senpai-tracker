import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  currentSeason,
  getAiringSchedule,
  getAnimeById,
  getSeasonal,
  getTrackedAiringSchedule,
  getTrending,
  searchAnime,
} from './index';

/**
 * Centralized query keys. Anything that reads or invalidates AniList data
 * references these so cache keys never drift between call sites.
 */
export const animeKeys = {
  all: ['anime'] as const,
  trending: () => [...animeKeys.all, 'trending'] as const,
  seasonal: (season: string, year: number) =>
    [...animeKeys.all, 'seasonal', season, year] as const,
  search: (q: string) => [...animeKeys.all, 'search', q] as const,
  detail: (id: number) => [...animeKeys.all, 'detail', id] as const,
  airing: (from: number, to: number) => [...animeKeys.all, 'airing', from, to] as const,
  trackedAiring: (ids: number[], from: number, to: number) =>
    [...animeKeys.all, 'airing', 'tracked', ids, from, to] as const,
};

export function useTrending() {
  return useQuery({
    queryKey: animeKeys.trending(),
    queryFn: () => getTrending(1, 24),
  });
}

export function useSeasonal() {
  const { season, year } = currentSeason();
  return useQuery({
    queryKey: animeKeys.seasonal(season, year),
    queryFn: () => getSeasonal(season, year, 1, 24),
  });
}

export function useSearchAnime(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: animeKeys.search(trimmed),
    queryFn: () => searchAnime(trimmed, 1, 30),
    enabled: trimmed.length >= 2,
    placeholderData: keepPreviousData,
  });
}

export function useAnime(id: number) {
  return useQuery({
    queryKey: animeKeys.detail(id),
    queryFn: () => getAnimeById(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

/** Airing schedule for the next `days` days (defaults to a week). */
export function useAiringSchedule(days = 7) {
  const from = Math.floor(Date.now() / 1000);
  const to = from + days * 24 * 60 * 60;
  return useQuery({
    queryKey: animeKeys.airing(from - (from % 3600), to - (to % 3600)),
    queryFn: () => getAiringSchedule(from, to, 1, 50),
  });
}

/**
 * Upcoming episodes for the user's tracked titles over the next `days` days.
 * Queries AniList by id (not by filtering the global feed), so every tracked
 * show airing in the window is returned regardless of how busy the season is.
 * A wider default window than `useAiringSchedule` since the result set is small.
 */
export function useTrackedAiringSchedule(ids: number[], days = 14) {
  const sorted = [...ids].sort((a, b) => a - b);
  const from = Math.floor(Date.now() / 1000);
  const to = from + days * 24 * 60 * 60;
  return useQuery({
    queryKey: animeKeys.trackedAiring(sorted, from - (from % 3600), to - (to % 3600)),
    queryFn: () => getTrackedAiringSchedule(sorted, from, to, 1, 50),
    enabled: sorted.length > 0,
  });
}
