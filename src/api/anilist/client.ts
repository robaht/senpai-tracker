import { GraphQLClient } from 'graphql-request';

/**
 * AniList GraphQL endpoint. Public read access needs no API key.
 *
 * Note on rate limits: AniList allows ~90 requests/minute. We never hand-roll
 * request loops — every read goes through TanStack Query, which dedupes and
 * caches, keeping us comfortably under the limit.
 */
export const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

export const anilistClient = new GraphQLClient(ANILIST_ENDPOINT, { headers: { ...BASE_HEADERS } });

/**
 * Attach (or clear) the OAuth bearer token for authenticated reads/writes (F1).
 * Replacing the full header set means signing out also removes Authorization.
 */
export function setAuthToken(token: string | null): void {
  anilistClient.setHeaders(token ? { ...BASE_HEADERS, Authorization: `Bearer ${token}` } : { ...BASE_HEADERS });
}

/**
 * Thin wrapper so callers get a typed result and a single place to add future
 * concerns (retry-after handling on 429, logging).
 */
export async function anilistRequest<TData, TVars extends object = object>(
  document: string,
  variables?: TVars,
): Promise<TData> {
  return anilistClient.request<TData>(document, variables);
}
