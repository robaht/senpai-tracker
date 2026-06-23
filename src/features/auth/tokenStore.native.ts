import * as SecureStore from 'expo-secure-store';

/**
 * Native token storage — the AniList bearer token is kept in the device keychain
 * via expo-secure-store. The web counterpart (`tokenStore.ts`) uses AsyncStorage.
 */
const KEY = 'senpai_anilist_token_v1'; // SecureStore keys must be alphanumeric/._-

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
