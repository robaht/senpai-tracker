import { GraphQLClient } from 'graphql-request';

/**
 * AniList GraphQL endpoint. Public read access needs no API key.
 *
 * Note on rate limits: AniList allows ~90 requests/minute. We never hand-roll
 * request loops — every read goes through TanStack Query, which dedupes and
 * caches, keeping us comfortably under the limit. If we later add OAuth writes,
 * an Authorization header gets attached here.
 */
export const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

export const anilistClient = new GraphQLClient(ANILIST_ENDPOINT, {
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * Thin wrapper so callers get a typed result and a single place to add future
 * concerns (auth header, retry-after handling on 429, logging).
 */
export async function anilistRequest<TData, TVars extends object = object>(
  document: string,
  variables?: TVars,
): Promise<TData> {
  return anilistClient.request<TData>(document, variables);
}
