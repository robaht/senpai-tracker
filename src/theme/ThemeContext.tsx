import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { usePreferencesStore } from '../features/preferences/store';
import {
  themes,
  type ThemeColors,
  type ThemeGradients,
  type ThemeName,
} from './tokens';

export interface ThemeContextValue {
  name: ThemeName;
  label: string;
  isDark: boolean;
  colors: ThemeColors;
  gradients: ThemeGradients;
}

function toValue(name: ThemeName): ThemeContextValue {
  const def = themes[name] ?? themes.midnight;
  return {
    name: def.name,
    label: def.label,
    isDark: def.isDark,
    colors: def.colors,
    gradients: def.gradients,
  };
}

const ThemeContext = createContext<ThemeContextValue>(toValue('midnight'));

/**
 * Resolves the active theme from persisted preferences + the OS color scheme,
 * and exposes it to the tree. Read it anywhere with `useTheme()`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const mode = usePreferencesStore((s) => s.mode);
  const manualTheme = usePreferencesStore((s) => s.manualTheme);
  const lightTheme = usePreferencesStore((s) => s.lightTheme);
  const darkTheme = usePreferencesStore((s) => s.darkTheme);

  const name: ThemeName =
    mode === 'system' ? (scheme === 'light' ? lightTheme : darkTheme) : manualTheme;

  const value = useMemo(() => toValue(name), [name]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active theme: colors, gradients, and metadata. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Build a themed StyleSheet. Returns a hook that recomputes (memoized) whenever
 * the active theme changes — the bridge that lets `StyleSheet.create` styles
 * react to live theme switches.
 *
 *   const useStyles = makeStyles(({ colors }) => ({
 *     card: { backgroundColor: colors.surface },
 *   }));
 *   function Card() { const styles = useStyles(); ... }
 *
 * Layout-only styles (spacing, radii) can live here too; they just ignore the
 * theme argument. `spacing`/`radii`/`typography` are imported directly since
 * they never change per theme.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: ThemeContextValue) => T,
): () => T {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
  };
}
