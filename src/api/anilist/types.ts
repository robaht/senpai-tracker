/**
 * AniList domain types.
 *
 * These mirror the subset of the AniList GraphQL schema we query. Field names
 * match the API exactly so query selection sets and types stay in lockstep.
 * The `Media` id here is the canonical key we use everywhere else in the app
 * (tracking entries, notifications) — see features/tracking.
 */

export type MediaFormat =
  | 'TV'
  | 'TV_SHORT'
  | 'MOVIE'
  | 'SPECIAL'
  | 'OVA'
  | 'ONA'
  | 'MUSIC';

export type MediaStatus =
  | 'FINISHED'
  | 'RELEASING'
  | 'NOT_YET_RELEASED'
  | 'CANCELLED'
  | 'HIATUS';

export type MediaSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

/**
 * How one Media connects to another. AniList relations form a graph (no
 * "season number"), so a linear S1→S2→S3 list is derived by walking
 * PREQUEL/SEQUEL edges — see lib/relations.ts.
 */
export type MediaRelationType =
  | 'SEQUEL'
  | 'PREQUEL'
  | 'PARENT'
  | 'SIDE_STORY'
  | 'SPIN_OFF'
  | 'ALTERNATIVE'
  | 'SUMMARY'
  | 'ADAPTATION'
  | 'CHARACTER'
  | 'SOURCE'
  | 'COMPILATION'
  | 'CONTAINS'
  | 'OTHER';

export interface MediaTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

export interface MediaCoverImage {
  extraLarge: string | null;
  large: string | null;
  color: string | null;
}

export interface AiringSchedule {
  /** Unix seconds when this episode airs. */
  airingAt: number;
  /** Seconds until air (negative if already aired). Server-computed. */
  timeUntilAiring: number;
  episode: number;
}

export interface MediaTrailer {
  id: string | null;
  site: string | null;
  thumbnail: string | null;
}

/** A single anime entry as returned by AniList. */
export interface Media {
  id: number;
  idMal: number | null;
  title: MediaTitle;
  coverImage: MediaCoverImage | null;
  bannerImage: string | null;
  format: MediaFormat | null;
  status: MediaStatus | null;
  description: string | null;
  episodes: number | null;
  duration: number | null;
  genres: string[];
  averageScore: number | null;
  popularity: number | null;
  season: MediaSeason | null;
  seasonYear: number | null;
  studios?: { nodes: { id: number; name: string }[] };
  nextAiringEpisode: AiringSchedule | null;
  trailer?: MediaTrailer | null;
  /**
   * Connected anime (sequels, prequels, side stories, …). Only populated on the
   * detail query; flattened from AniList's `relations { edges { … } }` shape by
   * getAnimeById. Absent elsewhere (and on relation nodes, to avoid recursion).
   */
  relations?: MediaRelationEdge[];
}

/** A single relation: how `node` connects to the anime it was fetched from. */
export interface MediaRelationEdge {
  relationType: MediaRelationType;
  node: Media;
}

/** Airing schedule row used by the weekly schedule screen. */
export interface AiringScheduleItem {
  id: number;
  airingAt: number;
  episode: number;
  media: Media;
}

export interface PageInfo {
  total: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
  perPage: number;
}

export interface Page<T> {
  pageInfo: PageInfo;
  items: T[];
}

/** Best display title: english → romaji → native, never empty. */
export function displayTitle(title: MediaTitle): string {
  return title.english || title.romaji || title.native || 'Untitled';
}
