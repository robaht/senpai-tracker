import { Platform } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';

/**
 * AniList OAuth config (implicit grant, zero backend). Client ids are public for
 * implicit grant, so they ship via `EXPO_PUBLIC_*` (inlined at build).
 *
 * AniList allows ONE redirect URL per registered client, so we register two
 * clients — one for local dev, one for the deployed site — and pick by origin on
 * web. Native (`senpai://`) needs its own client later; for now it falls back to
 * the dev id (web-first).
 */
export const ANILIST_DISCOVERY = {
  authorizationEndpoint: 'https://anilist.co/api/v2/oauth/authorize',
} as const;

const DEV_CLIENT_ID = process.env.EXPO_PUBLIC_ANILIST_CLIENT_ID_DEV ?? '';
const PROD_CLIENT_ID = process.env.EXPO_PUBLIC_ANILIST_CLIENT_ID_PROD ?? '';

/** Origin of the deployed web build. */
const PROD_ORIGIN = 'https://senpai-tracker.roobaht.workers.dev';

function isProdWeb(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location.origin === PROD_ORIGIN
  );
}

/** The AniList client id for the current environment ('' when unconfigured). */
export function getClientId(): string {
  return isProdWeb() ? PROD_CLIENT_ID : DEV_CLIENT_ID;
}

/**
 * The redirect URI for the current environment. On web we use the exact origin
 * (no path/trailing slash) so it matches the value registered with AniList;
 * native uses the custom scheme.
 */
export function getRedirectUri(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return makeRedirectUri({ scheme: 'senpai' });
}

/** Whether sign-in is configured at all — used to hide the UI when it isn't. */
export function isAuthConfigured(): boolean {
  return getClientId().length > 0;
}
