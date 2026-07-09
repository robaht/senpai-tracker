import { Platform } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';

/**
 * AniList OAuth config (implicit grant, zero backend). Client ids are public for
 * implicit grant, so they ship via `EXPO_PUBLIC_*` (inlined at build).
 *
 * AniList allows ONE redirect URL per registered client, so we register one
 * client per redirect — local dev, the deployed site, and native (`senpai://`) —
 * and pick by platform/origin. Until the native client id is set, native falls
 * back to the dev id (sign-in won't complete on device, but the UI stays testable).
 */
export const ANILIST_DISCOVERY = {
  authorizationEndpoint: 'https://anilist.co/api/v2/oauth/authorize',
} as const;

const DEV_CLIENT_ID = process.env.EXPO_PUBLIC_ANILIST_CLIENT_ID_DEV ?? '';
const PROD_CLIENT_ID = process.env.EXPO_PUBLIC_ANILIST_CLIENT_ID_PROD ?? '';
const NATIVE_CLIENT_ID = process.env.EXPO_PUBLIC_ANILIST_CLIENT_ID_NATIVE ?? '';

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
  if (Platform.OS !== 'web') return NATIVE_CLIENT_ID || DEV_CLIENT_ID;
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
