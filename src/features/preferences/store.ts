import { create } from 'zustand';
import { getLocales } from 'expo-localization';
import { themes, type ThemeName } from '../../theme/tokens';
import { preferencesRepository } from './repository';
import { DEFAULT_PREFERENCES, type Preferences, type ThemeMode } from './types';

interface PreferencesState extends Preferences {
  hydrated: boolean;

  /** Load persisted preferences into memory. Call once at app start. */
  hydrate: () => Promise<void>;

  setMode: (mode: ThemeMode) => void;
  /** Pick the theme used in manual mode (also remembers it as the light/dark slot). */
  setManualTheme: (name: ThemeName) => void;
  /** Pick the theme used when following the system in light / dark. */
  setLightTheme: (name: ThemeName) => void;
  setDarkTheme: (name: ThemeName) => void;
  /** Set the streaming region, or `null` to follow the device locale. */
  setRegion: (region: string | null) => void;
}

/** Device region from the OS locale, resolved once (used when region is `null`). */
const DEVICE_REGION = getLocales()[0]?.regionCode ?? null;

export const usePreferencesStore = create<PreferencesState>((set, get) => {
  // Fire-and-forget persistence; in-memory state drives rendering.
  const persist = () => {
    const { mode, manualTheme, lightTheme, darkTheme, region } = get();
    void preferencesRepository.save({ mode, manualTheme, lightTheme, darkTheme, region });
  };

  return {
    ...DEFAULT_PREFERENCES,
    hydrated: false,

    hydrate: async () => {
      const prefs = await preferencesRepository.get();
      set({ ...prefs, hydrated: true });
    },

    setMode: (mode) => {
      set({ mode });
      persist();
    },

    setManualTheme: (name) => {
      // Keep the matching system slot in sync so enabling "follow system" later
      // reuses the user's most recent light/dark choice.
      const slot = themes[name].isDark ? { darkTheme: name } : { lightTheme: name };
      set({ manualTheme: name, ...slot });
      persist();
    },

    setLightTheme: (name) => {
      set({ lightTheme: name });
      persist();
    },

    setDarkTheme: (name) => {
      set({ darkTheme: name });
      persist();
    },

    setRegion: (region) => {
      set({ region });
      persist();
    },
  };
});

/**
 * The effective streaming region: the user's explicit choice, or the device
 * locale's region when set to "auto" (`null`). May be `null` if the OS exposes
 * no region — callers should treat that as "no regional filtering".
 */
export function useRegion(): string | null {
  const region = usePreferencesStore((s) => s.region);
  return region ?? DEVICE_REGION;
}
