import { anilistRequest } from './client';
import {
  AIRING_SCHEDULE_QUERY,
  MEDIA_BY_ID_QUERY,
  SEARCH_QUERY,
  SEASONAL_QUERY,
  TRENDING_QUERY,
} from './queries';
import type { AiringScheduleItem, Media, MediaSeason, Page, PageInfo } from './types';

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

export async function getAnimeById(id: number): Promise<Media> {
  const data = await anilistRequest<{ Media: Media }>(MEDIA_BY_ID_QUERY, { id });
  return data.Media;
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
