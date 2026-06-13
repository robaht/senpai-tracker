/**
 * Design tokens — the single source of truth for the app's visual language.
 *
 * Everything visual references these values; nothing hard-codes a hex or a
 * magic number. Re-theming (e.g. a future light mode or alternate accent) is a
 * matter of swapping this object, which is why colors live behind semantic
 * names ("surface", "accent") rather than literal ones ("darkGray").
 */

const palette = {
  // Neutrals — a near-black base with a subtle blue/violet cast.
  ink900: '#07070C',
  ink800: '#0B0B12',
  ink700: '#12121C',
  ink600: '#15151F',
  ink500: '#1E1E2A',
  ink400: '#272735',
  ink300: '#343445',

  white: '#FFFFFF',
  cloud: '#F5F5FA',
  fog: '#A4A4B8',
  smoke: '#74748A',
  ash: '#4C4C5E',

  // Brand — violet → magenta → pink. The signature gradient.
  violet: '#7C5CFF',
  violetSoft: '#9B85FF',
  magenta: '#C04DFF',
  pink: '#FF5CA8',

  // Semantic accents (also used to color watch statuses).
  blue: '#4DA6FF',
  mint: '#3DDC97',
  amber: '#FFB020',
  red: '#FF5C6E',
} as const;

export const colors = {
  // Backgrounds
  bg: palette.ink800,
  bgDeep: palette.ink900,
  surface: palette.ink600,
  surfaceElevated: palette.ink500,
  surfaceHigh: palette.ink400,

  // Hairlines / borders
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.12)',

  // Text
  text: palette.cloud,
  textMuted: palette.fog,
  textFaint: palette.smoke,
  textDisabled: palette.ash,

  // Brand
  accent: palette.violet,
  accentSoft: palette.violetSoft,
  onAccent: palette.white,

  // Feedback
  positive: palette.mint,
  warning: palette.amber,
  danger: palette.red,
  info: palette.blue,

  // Overlays / scrims used over poster art
  scrim: 'rgba(7,7,12,0.0)',
  scrimStrong: 'rgba(7,7,12,0.92)',

  // Skeleton shimmer
  skeletonBase: palette.ink500,
  skeletonHighlight: palette.ink400,
} as const;

/** Gradients are expressed as ordered color stops for expo-linear-gradient. */
export const gradients = {
  brand: [palette.violet, palette.pink] as const,
  brandVertical: [palette.magenta, palette.violet] as const,
  // Bottom-up scrim placed over poster art so text stays legible.
  poster: ['rgba(7,7,12,0)', 'rgba(7,7,12,0.55)', 'rgba(7,7,12,0.96)'] as const,
  // Subtle top glow behind hero sections.
  heroGlow: ['rgba(124,92,255,0.28)', 'rgba(124,92,255,0)'] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 28,
  pill: 999,
} as const;

/**
 * Type scale. fontFamily values map to the Plus Jakarta Sans weights loaded in
 * the root layout — keep these keys in sync with that load call.
 */
export const fonts = {
  regular: 'Jakarta_400',
  medium: 'Jakarta_500',
  semibold: 'Jakarta_600',
  bold: 'Jakarta_700',
  extrabold: 'Jakarta_800',
} as const;

export const typography = {
  display: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
  subheading: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  callout: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 16, letterSpacing: 0.1 },
  overline: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2 },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Soft elevation shadow used on floating elements (tab bar, FAB, modals). */
export const shadow = {
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

export const theme = {
  colors,
  gradients,
  spacing,
  radii,
  fonts,
  typography,
  shadow,
} as const;

export type Theme = typeof theme;
