import { anilistRequest } from './client';
export { setAuthToken } from './client';
import {
  AIRING_SCHEDULE_QUERY,
  BROWSE_QUERY,
  GENRES_QUERY,
  MEDIA_BY_ID_QUERY,
  MEDIA_BY_MAL_IDS_QUERY,
  RECOMMENDATIONS_QUERY,
  SEARCH_QUERY,
  SEASONAL_QUERY,
  TRACKED_AIRING_SCHEDULE_QUERY,
  UPCOMING_PREMIERES_QUERY,
  TRENDING_QUERY,
  USER_LIST_QUERY,
  VIEWER_QUERY,
  MY_LIST_QUERY,
} from './queries';
import { SAVE_MEDIA_LIST_ENTRY, DELETE_MEDIA_LIST_ENTRY } from './mutations';
import type {
  AiringScheduleItem,
  BrowseFilters,
  CharacterEdge,
  ExternalLink,
  ImportedListEntry,
  Media,
  MediaListStatus,
  MediaRelationEdge,
  MediaSeason,
  Page,
  PageInfo,
  Recommendation,
  Viewer,
  MyListEntry,
  ScoreFormat,
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

interface RawRecommendation {
  rating: number | null;
  mediaRecommendation: Media | null;
}

/**
 * Recommendations for a single title, highest community-rated first. Drops
 * empty nodes and any without a cover (a cheap proxy for "not a real anime
 * entry"), so callers get clean, renderable Media.
 */
export async function getRecommendations(id: number): Promise<Recommendation[]> {
  const data = await anilistRequest<{
    Media: { recommendations: { nodes: RawRecommendation[] } | null } | null;
  }>(RECOMMENDATIONS_QUERY, { id });
  const nodes = data.Media?.recommendations?.nodes ?? [];
  return nodes
    .filter((n): n is RawRecommendation & { mediaRecommendation: Media } =>
      Boolean(n.mediaRecommendation?.coverImage),
    )
    .map((n) => ({ media: n.mediaRecommendation, rating: n.rating ?? 0 }));
}

/** The full list of AniList genres, alphabetical as returned by the API. */
export async function getGenres(): Promise<string[]> {
  const data = await anilistRequest<{ GenreCollection: string[] }>(GENRES_QUERY, {});
  return data.GenreCollection ?? [];
}

/**
 * Browse anime by genre + sort. An empty `genres` list browses everything for
 * the chosen sort; supplied genres are ANDed (`genre_in`).
 */
export async function browse(
  filters: BrowseFilters,
  page = 1,
  perPage = 24,
): Promise<Page<Media>> {
  const data = await anilistRequest<RawPage<{ media: Media[] }>>(BROWSE_QUERY, {
    genres: filters.genres.length > 0 ? filters.genres : undefined,
    sort: [filters.sort],
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

/**
 * AniList nests relations as `{ edges: [...] }`; we expose a flat array on Media.
 * externalLinks arrives flat but carries INFO/SOCIAL + disabled entries we drop.
 */
type RawExternalLink = ExternalLink & { type: string | null; isDisabled: boolean | null };
type RawMediaDetail = Omit<Media, 'relations' | 'characters' | 'externalLinks'> & {
  relations?: { edges: MediaRelationEdge[] };
  characters?: { edges: CharacterEdge[] };
  externalLinks?: RawExternalLink[];
};

export async function getAnimeById(id: number): Promise<Media> {
  const data = await anilistRequest<{ Media: RawMediaDetail }>(MEDIA_BY_ID_QUERY, { id });
  const { relations, characters, externalLinks, ...media } = data.Media;
  const streaming = (externalLinks ?? [])
    .filter((l) => l.type === 'STREAMING' && !l.isDisabled)
    .map(({ type, isDisabled, ...link }) => link);
  return {
    ...media,
    relations: relations?.edges ?? [],
    characters: characters?.edges ?? [],
    externalLinks: streaming,
  };
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

/**
 * Upcoming premieres (episode 1) within a unix-time window — shows that haven't
 * started airing yet, soonest first. Powers the Schedule screen's "Upcoming" view.
 */
export async function getUpcomingPremieres(
  from: number,
  to: number,
  page = 1,
  perPage = 50,
): Promise<Page<AiringScheduleItem>> {
  const data = await anilistRequest<RawPage<{ airingSchedules: AiringScheduleItem[] }>>(
    UPCOMING_PREMIERES_QUERY,
    { from, to, page, perPage },
  );
  return toPage(data.Page.pageInfo, data.Page.airingSchedules);
}

interface RawListEntry {
  status: MediaListStatus;
  progress: number | null;
  score: number | null;
  updatedAt: number | null;
  media: Media | null;
}

/**
 * Fetch a public AniList user's whole anime list by username, normalized and
 * de-duplicated by media id (a title can appear in several lists). Throws if the
 * user doesn't exist or the profile is private — the caller surfaces that.
 */
export async function getUserAnimeList(userName: string): Promise<ImportedListEntry[]> {
  const data = await anilistRequest<{
    MediaListCollection: { lists: { entries: RawListEntry[] }[] } | null;
  }>(USER_LIST_QUERY, { userName });

  const seen = new Set<number>();
  const out: ImportedListEntry[] = [];
  for (const list of data.MediaListCollection?.lists ?? []) {
    for (const e of list.entries ?? []) {
      if (!e.media || seen.has(e.media.id)) continue;
      seen.add(e.media.id);
      out.push({
        media: e.media,
        status: e.status,
        progress: e.progress ?? 0,
        score: Math.round(e.score ?? 0),
        updatedAt: e.updatedAt ? e.updatedAt * 1000 : Date.now(),
      });
    }
  }
  return out;
}

/**
 * Resolve MyAnimeList ids to AniList `Media`, one AniList page (≤50 ids) per
 * call. The MAL import chunks its ids and calls this per chunk so it stays under
 * AniList's ~90 req/min limit. Titles MAL knows but AniList doesn't simply don't
 * come back — the caller diffs the returned `idMal`s to report what was skipped.
 */
export async function getMediaByMalIds(malIds: number[]): Promise<Media[]> {
  if (malIds.length === 0) return [];
  const data = await anilistRequest<{ Page: { media: Media[] } }>(MEDIA_BY_MAL_IDS_QUERY, {
    malIds,
    perPage: malIds.length,
  });
  return data.Page.media ?? [];
}

/**
 * Fetch the currently authenticated user. Requires `setAuthToken` to have been
 * called with a valid bearer token; returns null if the token is missing/invalid.
 */
export async function getViewer(): Promise<Viewer | null> {
  const data = await anilistRequest<{
    Viewer: {
      id: number;
      name: string;
      avatar?: { large?: string | null; medium?: string | null } | null;
      mediaListOptions?: { scoreFormat?: ScoreFormat | null } | null;
    } | null;
  }>(VIEWER_QUERY, {});
  const v = data.Viewer;
  if (!v) return null;
  return {
    id: v.id,
    name: v.name,
    avatar: v.avatar?.large ?? v.avatar?.medium ?? null,
    scoreFormat: v.mediaListOptions?.scoreFormat ?? 'POINT_10',
  };
}

interface RawMyListEntry {
  id: number;
  status: MediaListStatus;
  progress: number | null;
  score: number | null;
  updatedAt: number | null;
  createdAt: number | null;
  media: Media | null;
}

/**
 * Fetch the authenticated viewer's whole anime list (F1 sync), de-duplicated by
 * media id, carrying the MediaList entry id (`remoteId`) needed for deletes.
 * Timestamps are converted to epoch ms to match `TrackEntry`.
 */
export async function getMyAnimeList(userId: number): Promise<MyListEntry[]> {
  const data = await anilistRequest<{
    MediaListCollection: { lists: { entries: RawMyListEntry[] }[] } | null;
  }>(MY_LIST_QUERY, { userId });

  const seen = new Set<number>();
  const out: MyListEntry[] = [];
  for (const list of data.MediaListCollection?.lists ?? []) {
    for (const e of list.entries ?? []) {
      if (!e.media || seen.has(e.media.id)) continue;
      seen.add(e.media.id);
      out.push({
        media: e.media,
        remoteId: e.id,
        status: e.status,
        progress: e.progress ?? 0,
        score: Math.round(e.score ?? 0),
        updatedAt: e.updatedAt ? e.updatedAt * 1000 : Date.now(),
        createdAt: e.createdAt ? e.createdAt * 1000 : Date.now(),
      });
    }
  }
  return out;
}

/** Upsert a list entry on AniList; returns the MediaList entry id (`remoteId`). */
export async function saveMediaListEntry(vars: {
  mediaId: number;
  status: MediaListStatus;
  progress: number;
  score: number;
}): Promise<number | null> {
  const data = await anilistRequest<{ SaveMediaListEntry: { id: number } | null }>(
    SAVE_MEDIA_LIST_ENTRY,
    vars,
  );
  return data.SaveMediaListEntry?.id ?? null;
}

/** Delete a list entry on AniList by its MediaList entry id. */
export async function deleteMediaListEntry(id: number): Promise<void> {
  await anilistRequest<{ DeleteMediaListEntry: { deleted: boolean } | null }>(
    DELETE_MEDIA_LIST_ENTRY,
    { id },
  );
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

/** Seasons in AniList's calendar order; the year rolls over at the Fall→Winter wrap. */
const SEASON_ORDER: MediaSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

/** The season+year before the given one (Winter → previous year's Fall). */
export function prevSeason({ season, year }: { season: MediaSeason; year: number }): {
  season: MediaSeason;
  year: number;
} {
  const i = SEASON_ORDER.indexOf(season);
  return i === 0
    ? { season: 'FALL', year: year - 1 }
    : { season: SEASON_ORDER[i - 1], year };
}

/** The season+year after the given one (Fall → next year's Winter). */
export function nextSeason({ season, year }: { season: MediaSeason; year: number }): {
  season: MediaSeason;
  year: number;
} {
  const i = SEASON_ORDER.indexOf(season);
  return i === SEASON_ORDER.length - 1
    ? { season: 'WINTER', year: year + 1 }
    : { season: SEASON_ORDER[i + 1], year };
}
