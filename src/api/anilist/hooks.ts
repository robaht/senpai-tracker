import {
  useInfiniteQuery,
  useQuery,
  keepPreviousData,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  browse,
  currentSeason,
  getAiringSchedule,
  getAnimeById,
  getGenres,
  getSeasonal,
  getTrackedAiringSchedule,
  getTrending,
  searchAnime,
} from './index';
import type { BrowseFilters, MediaSeason, Page } from './types';

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
  genres: () => [...animeKeys.all, 'genres'] as const,
  browse: (filters: BrowseFilters) =>
    [...animeKeys.all, 'browse', [...filters.genres].sort(), filters.sort] as const,
  detail: (id: number) => [...animeKeys.all, 'detail', id] as const,
  airing: (from: number, to: number) => [...animeKeys.all, 'airing', from, to] as const,
  trackedAiring: (ids: number[], from: number, to: number) =>
    [...animeKeys.all, 'airing', 'tracked', ids, from, to] as const,
};

/**
 * Flatten an infinite query's pages into a single de-duplicated list. AniList's
 * popularity/trending sorts can shift an item across page boundaries, so the
 * same id occasionally appears on two pages — dedupe by id to honor "never
 * duplicates" and avoid duplicate React keys.
 */
export function flattenPages<T>(
  data: InfiniteData<Page<T>> | undefined,
  getId: (item: T) => number | string,
): T[] {
  if (!data) return [];
  const seen = new Set<number | string>();
  const out: T[] = [];
  for (const page of data.pages) {
    for (const item of page.items) {
      const id = getId(item);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(item);
    }
  }
  return out;
}

/** `getNextPageParam` shared by every paged AniList query. */
const nextPage = (last: Page<unknown>) =>
  last.pageInfo.hasNextPage ? last.pageInfo.currentPage + 1 : undefined;

export function useTrending() {
  return useQuery({
    queryKey: animeKeys.trending(),
    queryFn: () => getTrending(1, 24),
  });
}

/** Browse any season + year. Shares the seasonal cache key with `useSeasonal`. */
export function useSeasonalBrowse(season: MediaSeason, year: number) {
  return useInfiniteQuery({
    queryKey: animeKeys.seasonal(season, year),
    queryFn: ({ pageParam }) => getSeasonal(season, year, pageParam, 24),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
}

export function useSeasonal() {
  const { season, year } = currentSeason();
  return useSeasonalBrowse(season, year);
}

/** The static AniList genre list — cached aggressively since it rarely changes. */
export function useGenres() {
  return useQuery({
    queryKey: animeKeys.genres(),
    queryFn: getGenres,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/** Browse by genre + sort. Keeps the previous results visible while refiltering. */
export function useBrowse(filters: BrowseFilters) {
  return useInfiniteQuery({
    queryKey: animeKeys.browse(filters),
    queryFn: ({ pageParam }) => browse(filters, pageParam, 24),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    placeholderData: keepPreviousData,
  });
}

export function useSearchAnime(query: string) {
  const trimmed = query.trim();
  return useInfiniteQuery({
    queryKey: animeKeys.search(trimmed),
    queryFn: ({ pageParam }) => searchAnime(trimmed, pageParam, 30),
    initialPageParam: 1,
    getNextPageParam: nextPage,
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
  return useInfiniteQuery({
    queryKey: animeKeys.airing(from - (from % 3600), to - (to % 3600)),
    queryFn: ({ pageParam }) => getAiringSchedule(from, to, pageParam, 50),
    initialPageParam: 1,
    getNextPageParam: nextPage,
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
  return useInfiniteQuery({
    queryKey: animeKeys.trackedAiring(sorted, from - (from % 3600), to - (to % 3600)),
    queryFn: ({ pageParam }) => getTrackedAiringSchedule(sorted, from, to, pageParam, 50),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: sorted.length > 0,
  });
}
