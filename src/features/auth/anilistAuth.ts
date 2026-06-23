import { ResponseType, useAuthRequest } from 'expo-auth-session';
import { ANILIST_DISCOVERY, getClientId, getRedirectUri } from './config';

/**
 * AniList OAuth implicit-grant request. Returns the expo-auth-session tuple;
 * the caller awaits `promptAsync()` and, on `response.type === 'success'`, reads
 * `response.params.access_token` and hands it to `useAuthStore.completeSignIn`.
 *
 * Implicit grant → `ResponseType.Token`, no PKCE, no scopes (AniList ignores
 * them); the token comes back in the redirect URL fragment.
 */
export function useAniListSignIn() {
  return useAuthRequest(
    {
      clientId: getClientId(),
      redirectUri: getRedirectUri(),
      responseType: ResponseType.Token,
      usePKCE: false,
      scopes: [],
    },
    ANILIST_DISCOVERY,
  );
}
