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

/** The subset of AniList's MediaSort we expose in the Browse screen. */
export type MediaSort = 'POPULARITY_DESC' | 'SCORE_DESC' | 'TRENDING_DESC';

/** Active filter state for the genre/tag Browse screen. */
export interface BrowseFilters {
  /** Genres to AND together (`genre_in`); empty means no genre constraint. */
  genres: string[];
  sort: MediaSort;
}

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

/**
 * A streaming/where-to-watch link from AniList's `externalLinks`. Only STREAMING
 * links survive into the app (getAnimeById drops INFO/SOCIAL + disabled ones).
 * `language` is AniList's per-link region signal (e.g. "German", "English") and
 * is what lib/streaming.ts uses to decide regional relevance — it's the closest
 * thing AniList exposes to per-country availability (there is no catalog field).
 */
export interface ExternalLink {
  id: number;
  url: string;
  /** Service name, e.g. "Crunchyroll", "Netflix", "Bilibili TV". */
  site: string;
  /** Full English language name, or null when the link isn't region-tagged. */
  language: string | null;
  /** Brand hex like "#F47521", or null. */
  color: string | null;
  /** URL to a small service icon, or null. */
  icon: string | null;
  /** Free-text note AniList sometimes attaches, e.g. "Dub". */
  notes: string | null;
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
  /**
   * Main characters + their (Japanese) voice actors. Only populated on the detail
   * query; flattened from AniList's `characters { edges { … } }` by getAnimeById.
   */
  characters?: CharacterEdge[];
  /**
   * Where-to-watch links. Only populated on the detail query; filtered to
   * STREAMING (non-disabled) by getAnimeById. Region handling lives in
   * lib/streaming.ts.
   */
  externalLinks?: ExternalLink[];
}

/** A single relation: how `node` connects to the anime it was fetched from. */
export interface MediaRelationEdge {
  relationType: MediaRelationType;
  node: Media;
}

/** A character's billing on a title. */
export type CharacterRole = 'MAIN' | 'SUPPORTING' | 'BACKGROUND';

/** A person credited on a title — here, a (Japanese) voice actor. */
export interface VoiceActor {
  id: number;
  name: { full: string | null };
  image: { large: string | null } | null;
}

/**
 * A character on a title plus the voice actors who play them. Only populated on
 * the detail query; flattened from AniList's `characters { edges { … } }` shape
 * by getAnimeById. `voiceActors` is restricted to Japanese (see MEDIA_BY_ID_QUERY).
 */
export interface CharacterEdge {
  role: CharacterRole | null;
  node: {
    id: number;
    name: { full: string | null };
    image: { large: string | null } | null;
  };
  voiceActors: VoiceActor[];
}

/**
 * AniList's MediaListStatus enum — deliberately identical to our local
 * `WatchStatus` (see features/tracking/types), so an imported entry's status
 * drops straight onto a TrackEntry with no mapping.
 */
export type MediaListStatus =
  | 'CURRENT'
  | 'PLANNING'
  | 'COMPLETED'
  | 'DROPPED'
  | 'PAUSED'
  | 'REPEATING';

/**
 * One entry from a user's AniList list, normalized for import. `score` is on the
 * 0–10 scale (queried via `score(format: POINT_10)`) and `updatedAt` is in epoch
 * ms (AniList returns seconds; we convert) so it lines up with TrackEntry's
 * last-write-wins merge field.
 */
export interface ImportedListEntry {
  media: Media;
  status: MediaListStatus;
  progress: number;
  score: number;
  updatedAt: number;
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
