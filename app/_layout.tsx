import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryProvider } from '../src/providers/QueryProvider';
import { useTrackingStore } from '../src/features/tracking/store';
import { useComfortStore } from '../src/features/comfort/store';
import { usePreferencesStore } from '../src/features/preferences/store';
import { useDismissedStore } from '../src/features/recommendations/store';
import { useAuthStore } from '../src/features/auth/store';
import { pullAndReconcile } from '../src/features/tracking/sync';
import { ThemeProvider, useTheme } from '../src/theme';

// Closes the OAuth popup and delivers the redirect result on web (F1).
WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Jakarta_400: PlusJakartaSans_400Regular,
    Jakarta_500: PlusJakartaSans_500Medium,
    Jakarta_600: PlusJakartaSans_600SemiBold,
    Jakarta_700: PlusJakartaSans_700Bold,
    Jakarta_800: PlusJakartaSans_800ExtraBold,
  });

  // Load persisted state into memory once at startup.
  const hydrateTracking = useTrackingStore((s) => s.hydrate);
  const hydrateComfort = useComfortStore((s) => s.hydrate);
  const hydratePrefs = usePreferencesStore((s) => s.hydrate);
  const hydrateDismissed = useDismissedStore((s) => s.hydrate);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const authStatus = useAuthStore((s) => s.status);
  const prefsHydrated = usePreferencesStore((s) => s.hydrated);
  useEffect(() => {
    void hydrateTracking();
    void hydrateComfort();
    void hydratePrefs();
    void hydrateDismissed();
    void hydrateAuth();
  }, [hydrateTracking, hydrateComfort, hydratePrefs, hydrateDismissed, hydrateAuth]);

  // Once signed in (on sign-in or an authed app-start), pull + reconcile the
  // AniList list. Guarded against overlap inside `pullAndReconcile`.
  useEffect(() => {
    if (authStatus === 'signedIn') void pullAndReconcile();
  }, [authStatus]);

  // Gate on prefs too, so a saved light theme doesn't flash the dark default.
  const ready = fontsLoaded && prefsHydrated;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryProvider>
          <ThemeProvider>
            <RootNavigator ready={ready} />
          </ThemeProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Lives inside ThemeProvider so the chrome (status bar, backgrounds) follows the theme. */
function RootNavigator({ ready }: { ready: boolean }) {
  const { colors, isDark } = useTheme();

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="anime/[id]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="stats" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="wrapped" options={{ animation: 'fade' }} />
        <Stack.Screen name="comfort" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="seasons" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}
