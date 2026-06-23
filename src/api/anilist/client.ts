import { ClientError, GraphQLClient } from 'graphql-request';

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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Single choke point for every AniList request. Retries on rate-limit (HTTP 429)
 * up to a few times, honoring the `Retry-After` header (seconds) when present and
 * otherwise backing off exponentially. This keeps bulk sync uploads from silently
 * dropping entries when AniList throttles (~90 req/min).
 */
export async function anilistRequest<TData, TVars extends object = object>(
  document: string,
  variables?: TVars,
): Promise<TData> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await anilistClient.request<TData>(document, variables);
    } catch (err) {
      const status = err instanceof ClientError ? err.response.status : 0;
      if (status !== 429 || attempt >= 4) throw err;
      const retryAfter = Number(err instanceof ClientError ? err.response.headers?.get?.('Retry-After') : 0);
      const waitSec = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 2 ** attempt;
      await sleep(Math.min(waitSec * 1000, 60000));
    }
  }
}
