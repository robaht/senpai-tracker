import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Web token storage. There's no SecureStore on web, so the AniList bearer token
 * lives in AsyncStorage (localStorage). The native counterpart
 * (`tokenStore.native.ts`) uses expo-secure-store. Metro picks the right one.
 */
const KEY = 'senpai:anilist-token:v1';

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
