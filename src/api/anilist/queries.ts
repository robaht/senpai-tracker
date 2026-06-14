import { gql } from 'graphql-request';

/**
 * Shared selection set for an anime. Kept as one fragment so every query
 * returns an identically-shaped `Media`, which makes the `Media` TS type a safe
 * cast across trending / search / detail / schedule.
 */
export const MEDIA_FIELDS = gql`
  fragment MediaFields on Media {
    id
    idMal
    title {
      romaji
      english
      native
    }
    coverImage {
      extraLarge
      large
      color
    }
    bannerImage
    format
    status
    description(asHtml: false)
    episodes
    duration
    genres
    averageScore
    popularity
    season
    seasonYear
    studios(isMain: true) {
      nodes {
        id
        name
      }
    }
    nextAiringEpisode {
      airingAt
      timeUntilAiring
      episode
    }
    trailer {
      id
      site
      thumbnail
    }
  }
`;

/** Trending now — the Discover hero rail. */
export const TRENDING_QUERY = gql`
  ${MEDIA_FIELDS}
  query Trending($page: Int = 1, $perPage: Int = 20) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
        ...MediaFields
      }
    }
  }
`;

/** Most popular this season. */
export const SEASONAL_QUERY = gql`
  ${MEDIA_FIELDS}
  query Seasonal($season: MediaSeason!, $seasonYear: Int!, $page: Int = 1, $perPage: Int = 20) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        hasNextPage
        currentPage
        lastPage
        total
        perPage
      }
      media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
        ...MediaFields
      }
    }
  }
`;

/** Full-text search. */
export const SEARCH_QUERY = gql`
  ${MEDIA_FIELDS}
  query Search($search: String!, $page: Int = 1, $perPage: Int = 20) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        hasNextPage
        currentPage
        lastPage
        total
        perPage
      }
      media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
        ...MediaFields
      }
    }
  }
`;

/**
 * Single anime detail. Adds `relations` on top of the shared fragment — each
 * related node reuses MediaFields (so it's a full Media and PosterCard works on
 * it directly), but nodes intentionally omit their own `relations` to keep the
 * payload bounded (relations are a graph; one hop is enough for the detail rail).
 */
export const MEDIA_BY_ID_QUERY = gql`
  ${MEDIA_FIELDS}
  query MediaById($id: Int!) {
    Media(id: $id, type: ANIME) {
      ...MediaFields
      relations {
        edges {
          relationType
          node {
            ...MediaFields
          }
        }
      }
    }
  }
`;

/**
 * Airing schedule within a unix-time window — powers the weekly schedule.
 * We sort ascending so the soonest episode is first.
 */
export const AIRING_SCHEDULE_QUERY = gql`
  ${MEDIA_FIELDS}
  query AiringSchedule($from: Int!, $to: Int!, $page: Int = 1, $perPage: Int = 50) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        hasNextPage
        currentPage
        lastPage
        total
        perPage
      }
      airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
        id
        airingAt
        episode
        media {
          ...MediaFields
        }
      }
    }
  }
`;

/**
 * Airing schedule for a *specific set of media ids* within a time window —
 * powers the Schedule screen's "My list" filter.
 *
 * AIRING_SCHEDULE_QUERY pulls *all* airing anime soonest-first and (capped at one
 * page) truncates long before reaching most of the user's titles, so filtering it
 * client-side hides tracked shows that air later in the week. This asks AniList
 * for exactly the tracked ids, so every tracked show airing in the window comes
 * back regardless of global volume.
 */
export const TRACKED_AIRING_SCHEDULE_QUERY = gql`
  ${MEDIA_FIELDS}
  query TrackedAiringSchedule($ids: [Int!], $from: Int!, $to: Int!, $page: Int = 1, $perPage: Int = 50) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        hasNextPage
        currentPage
        lastPage
        total
        perPage
      }
      airingSchedules(mediaId_in: $ids, airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
        id
        airingAt
        episode
        media {
          ...MediaFields
        }
      }
    }
  }
`;
