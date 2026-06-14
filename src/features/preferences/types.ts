import type { ThemeName } from '../../theme/tokens';

/**
 * How the active theme is chosen.
 * - `manual`  — always use `manualTheme`.
 * - `system`  — follow the OS appearance: use `darkTheme` when the device is in
 *               dark mode, `lightTheme` when it's in light mode.
 */
export type ThemeMode = 'manual' | 'system';

export interface Preferences {
  mode: ThemeMode;
  /** Active theme in `manual` mode. */
  manualTheme: ThemeName;
  /** Theme used in `system` mode when the OS is in light mode. */
  lightTheme: ThemeName;
  /** Theme used in `system` mode when the OS is in dark mode. */
  darkTheme: ThemeName;
  /**
   * 2-letter country code used to tailor "where to watch" streaming links.
   * `null` means follow the device locale (the default).
   */
  region: string | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
  mode: 'manual',
  manualTheme: 'midnight',
  lightTheme: 'cozy',
  darkTheme: 'midnight',
  region: null,
};
