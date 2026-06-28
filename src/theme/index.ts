// Theme-invariant tokens (safe to import statically anywhere).
export {
  spacing,
  radii,
  fonts,
  typography,
  shadow,
  themes,
  THEME_LIST,
  DEFAULT_THEME,
  splashColor,
} from './tokens';
export type {
  TypographyVariant,
  ThemeName,
  ThemeColors,
  ThemeGradients,
  ThemeDef,
  ColorToken,
} from './tokens';

// Motion tokens — theme-invariant timing/easing/springs (safe to import statically).
export { motion } from './motion';
export type { Motion } from './motion';
export { useMotion } from './useMotion';

// Runtime theme access — colors & gradients come from here, never statically.
export { ThemeProvider, useTheme, makeStyles } from './ThemeContext';
export type { ThemeContextValue } from './ThemeContext';
