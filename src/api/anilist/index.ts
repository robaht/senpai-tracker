import { anilistRequest } from './client';
import {
  AIRING_SCHEDULE_QUERY,
  MEDIA_BY_ID_QUERY,
  SEARCH_QUERY,
  SEASONAL_QUERY,
  TRACKED_AIRING_SCHEDULE_QUERY,
  TRENDING_QUERY,
} from './queries';
import type {
  AiringScheduleItem,
  Media,
  MediaRelationEdge,
  MediaSeason,
  Page,
  PageInfo,
} from './types';

export * from './types';

interface RawPage<T> {
  Page: { pageInfo: PageInfo } & T;
}

function toPage<T>(pageInfo: PageInfo, items: T[]): Page<T> {
  return { pageInfo, items };
}

export async function getTrending(page = 1, perPage = 20): Promise<Page<Media>> {
  const data = await anilistRequest<RawPage<{ media: Media[] }>>(TRENDING_QUERY, {
    page,
    perPage,
  });
  return toPage(data.Page.pageInfo, data.Page.media);
}

export async function getSeasonal(
  season: MediaSeason,
  seasonYear: number,
  page = 1,
  perPage = 20,
): Promise<Page<Media>> {
  const data = await anilistRequest<RawPage<{ media: Media[] }>>(SEASONAL_QUERY, {
    season,
    seasonYear,
    page,
    perPage,
  });
  return toPage(data.Page.pageInfo, data.Page.media);
}

export async function searchAnime(search: string, page = 1, perPage = 20): Promise<Page<Media>> {
  const data = await anilistRequest<RawPage<{ media: Media[] }>>(SEARCH_QUERY, {
    search,
    page,
    perPage,
  });
  return toPage(data.Page.pageInfo, data.Page.media);
}

/** AniList nests relations as `{ edges: [...] }`; we expose a flat array on Media. */
type RawMediaDetail = Omit<Media, 'relations'> & {
  relations?: { edges: MediaRelationEdge[] };
};

export async function getAnimeById(id: number): Promise<Media> {
  const data = await anilistRequest<{ Media: RawMediaDetail }>(MEDIA_BY_ID_QUERY, { id });
  const { relations, ...media } = data.Media;
  return { ...media, relations: relations?.edges ?? [] };
}

export async function getAiringSchedule(
  from: number,
  to: number,
  page = 1,
  perPage = 50,
): Promise<Page<AiringScheduleItem>> {
  const data = await anilistRequest<RawPage<{ airingSchedules: AiringScheduleItem[] }>>(
    AIRING_SCHEDULE_QUERY,
    { from, to, page, perPage },
  );
  return toPage(data.Page.pageInfo, data.Page.airingSchedules);
}

/**
 * Upcoming episodes for a specific set of media ids (the user's tracked list).
 * Returns an empty page for an empty id list without hitting the network.
 */
export async function getTrackedAiringSchedule(
  ids: number[],
  from: number,
  to: number,
  page = 1,
  perPage = 50,
): Promise<Page<AiringScheduleItem>> {
  if (ids.length === 0) {
    return toPage({ total: 0, currentPage: 1, lastPage: 1, hasNextPage: false, perPage }, []);
  }
  const data = await anilistRequest<RawPage<{ airingSchedules: AiringScheduleItem[] }>>(
    TRACKED_AIRING_SCHEDULE_QUERY,
    { ids, from, to, page, perPage },
  );
  return toPage(data.Page.pageInfo, data.Page.airingSchedules);
}

/** Returns the AniList season + year for a given date (defaults to now). */
export function currentSeason(date = new Date()): { season: MediaSeason; year: number } {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();
  if (month <= 1 || month === 11) {
    // Dec, Jan, Feb -> Winter (December belongs to the upcoming year's winter).
    return { season: 'WINTER', year: month === 11 ? year + 1 : year };
  }
  if (month <= 4) return { season: 'SPRING', year };
  if (month <= 7) return { season: 'SUMMER', year };
  return { season: 'FALL', year };
}
