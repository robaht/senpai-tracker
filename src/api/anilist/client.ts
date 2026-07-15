import { ClientError, GraphQLClient } from 'graphql-request';

/**
 * AniList GraphQL endpoint. Public read access needs no API key.
 *
 * Note on rate limits: AniList's documented cap is ~90 requests/minute, but the
 * API has been degraded to ~30/minute for a long time, so throttling is a
 * normal condition, not an edge case. Every read goes through TanStack Query
 * (dedupe + cache) and every request goes through `anilistRequest` below.
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

/** True when the error is an AniList HTTP 429 (rate limit). */
export function isRateLimited(err: unknown): boolean {
  return err instanceof ClientError && err.response.status === 429;
}

export interface AnilistRequestOpts {
  /** Abort the request if AniList hasn't responded within this window. */
  timeoutMs?: number;
  /** Extra attempts after a 429 before giving up. */
  maxRetries?: number;
  /** Cap on a single 429 backoff wait — AniList's Retry-After can be 60s. */
  maxWaitMs?: number;
}

/**
 * Patient profile for background/bulk work (sync push, MAL import): fully honor
 * long Retry-After waits so throttled batches never silently drop entries.
 * Interactive reads use the defaults instead — fail fast so screens can show an
 * error state (with retry) rather than hanging for a minute.
 */
export const PATIENT: AnilistRequestOpts = { timeoutMs: 30000, maxRetries: 4, maxWaitMs: 60000 };

/**
 * Single choke point for every AniList request. Adds a hard timeout (hung
 * connections otherwise spin forever — graphql-request has no default timeout)
 * and retries on rate-limit (HTTP 429), honoring the `Retry-After` header
 * (seconds) when present and otherwise backing off exponentially.
 */
export async function anilistRequest<TData, TVars extends object = object>(
  document: string,
  variables?: TVars,
  opts: AnilistRequestOpts = {},
): Promise<TData> {
  const { timeoutMs = 15000, maxRetries = 2, maxWaitMs = 8000 } = opts;
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await anilistClient.request<TData>({
        document,
        variables,
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(`AniList request timed out after ${Math.round(timeoutMs / 1000)}s`);
      }
      if (!isRateLimited(err) || attempt >= maxRetries) throw err;
      const retryAfter = Number((err as ClientError).response.headers?.get?.('Retry-After'));
      const waitSec = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 2 ** attempt;
      await sleep(Math.min(waitSec * 1000, maxWaitMs));
    } finally {
      clearTimeout(timer);
    }
  }
}
