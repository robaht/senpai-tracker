import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { getClientId, getRedirectUri } from './config';

/**
 * AniList OAuth implicit grant.
 *
 * AniList's authorize endpoint is non-standard: its documented implicit URL takes
 * ONLY `client_id` + `response_type=token` and uses the client's *registered*
 * redirect automatically (passing extra params makes it reject the request). The
 * token comes back in the redirect URL fragment.
 *
 * - **Web:** a full-page redirect (popups are unreliable / blocked on mobile web).
 *   The app navigates away and AniList returns it to the registered redirect with
 *   `#access_token=…`; the auth store consumes that fragment on next load
 *   (see `useAuthStore.hydrate`). So this resolves to null — the page is gone.
 * - **Native:** an in-app browser auth session that resolves with the token.
 */
export async function signInWithAniList(): Promise<string | null> {
  const clientId = getClientId();
  if (!clientId) return null;

  const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${encodeURIComponent(clientId)}&response_type=token`;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.location.assign(authUrl);
    return null;
  }

  const result = await WebBrowser.openAuthSessionAsync(authUrl, getRedirectUri());
  if (result.type !== 'success' || !result.url) return null;
  return new URLSearchParams(result.url.split('#')[1] ?? '').get('access_token');
}

/**
 * Web: capture the implicit-grant token from the URL fragment ONCE at module
 * load — before expo-router boots and re-syncs the URL — and clear it from the
 * address bar/history immediately so the bearer token doesn't linger. The auth
 * store's `hydrate` calls `consumeRedirectToken` to claim it exactly once.
 */
let pendingRedirectToken: string | null = null;
if (typeof window !== 'undefined' && window.location?.hash?.includes('access_token')) {
  pendingRedirectToken = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('access_token');
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    // ignore — non-fatal if history can't be rewritten
  }
}

/** Hand the redirect token (captured at load) to the caller exactly once. */
export function consumeRedirectToken(): string | null {
  const token = pendingRedirectToken;
  pendingRedirectToken = null;
  return token;
}
