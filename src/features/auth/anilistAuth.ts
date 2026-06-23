import * as WebBrowser from 'expo-web-browser';
import { getClientId, getRedirectUri } from './config';

/**
 * AniList OAuth implicit grant.
 *
 * AniList's authorize endpoint is strict and non-standard: its documented
 * implicit URL takes ONLY `client_id` + `response_type=token` and uses the
 * client's *registered* redirect automatically. A generic OAuth lib
 * (expo-auth-session) also appends `redirect_uri` + `state`, which AniList
 * rejects ("grant type is not supported / check required parameters"). So we
 * build the URL by hand and capture the redirect ourselves with expo-web-browser.
 *
 * The access token is returned in the redirect URL fragment
 * (`#access_token=…&token_type=Bearer&expires_in=…`).
 */
export async function signInWithAniList(): Promise<string | null> {
  const clientId = getClientId();
  if (!clientId) return null;

  const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${encodeURIComponent(clientId)}&response_type=token`;
  const result = await WebBrowser.openAuthSessionAsync(authUrl, getRedirectUri());
  if (result.type !== 'success' || !result.url) return null;

  const fragment = result.url.split('#')[1] ?? '';
  return new URLSearchParams(fragment).get('access_token');
}
