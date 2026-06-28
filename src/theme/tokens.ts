/**
 * Design tokens — the single source of truth for the app's visual language.
 *
 * Everything visual references these values; nothing hard-codes a hex or a
 * magic number. The app ships several *themes* (see `themes` below). Spacing,
 * radii, type and elevation are theme-invariant and exported directly; only
 * `colors` and `gradients` change per theme and are resolved at runtime through
 * `useTheme()` (never imported statically — that's what makes live theme
 * switching possible).
 */

// ---------------------------------------------------------------------------
// Theme-invariant tokens (identical in every theme)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Per-theme shape & type overrides.
//
// `radii`, `shadow` and `typography` above are the DEFAULTS used by every theme
// unless its `ThemeDef` overrides them. Only the retro "Pixel RPG" theme does:
// hard square corners, a blur-free offset shadow, and pixel fonts. Resolved at
// runtime in ThemeContext so live theme switching flips corners + fonts too.
// ---------------------------------------------------------------------------

export type RadiiScale = Record<keyof typeof radii, number>;
interface ShadowStyle {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
}
export type ShadowSet = Record<keyof typeof shadow, ShadowStyle>;

/** Hard square corners for the pixel theme — only a hair of rounding. */
export const PIXEL_RADII: RadiiScale = {
  sm: 2,
  md: 2,
  lg: 2,
  xl: 3,
  '2xl': 3,
  pill: 3,
};

const PIXEL_NAVY = '#283C7C';

/** Blur-free hard offset "block" shadow — the retro drop look. */
export const PIXEL_SHADOW: ShadowSet = {
  floating: {
    shadowColor: PIXEL_NAVY,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 0,
  },
  card: {
    shadowColor: PIXEL_NAVY,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 0,
  },
} as const;

/** A resolved per-variant text style, and a partial per-theme override of it. */
export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
}
export type TypeScale = Record<TypographyVariant, TypeStyle>;
export type TypeOverride = Partial<Record<TypographyVariant, TypeStyle>>;

/**
 * Hybrid pixel type for the retro theme: Silkscreen for headings/labels,
 * Press Start 2P for tiny all-caps badges/overlines, and the more legible
 * Pixelify Sans for long titles + body so anime names stay readable.
 */
const PIXEL_TYPE: TypeOverride = {
  display: { fontFamily: 'SilkscreenBold', fontSize: 26, lineHeight: 32, letterSpacing: 0 },
  title: { fontFamily: 'SilkscreenBold', fontSize: 19, lineHeight: 26, letterSpacing: 0 },
  heading: { fontFamily: 'SilkscreenBold', fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  subheading: { fontFamily: 'PixelifySansBold', fontSize: 17, lineHeight: 23 },
  body: { fontFamily: 'PixelifySans', fontSize: 16, lineHeight: 24 },
  bodyMedium: { fontFamily: 'PixelifySansBold', fontSize: 16, lineHeight: 24 },
  callout: { fontFamily: 'Silkscreen', fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  caption: { fontFamily: 'Silkscreen', fontSize: 11, lineHeight: 16, letterSpacing: 0 },
  overline: { fontFamily: 'PressStart2P', fontSize: 8, lineHeight: 13, letterSpacing: 1 },
};

// ---------------------------------------------------------------------------
// On-media tokens — IDENTICAL in every theme.
//
// These colors sit *over poster artwork* (banners, covers), which is always
// photographic/colorful regardless of theme. They must therefore stay a fixed
// dark-scrim + light-foreground pairing in light themes too, or text over art
// would become unreadable. Never use the theme's `text`/`warning` over media —
// reach for these instead.
// ---------------------------------------------------------------------------

const onMedia = {
  /** Primary foreground over artwork (titles on a banner). */
  onMedia: '#FFFFFF',
  /** Secondary foreground over artwork (meta rows). */
  onMediaMuted: 'rgba(255,255,255,0.82)',
  /** Score star over artwork — a constant warm gold. */
  onMediaAmber: '#FFC24B',
  /** Background for chips that float on artwork (score badge). */
  mediaScrim: 'rgba(7,7,12,0.7)',
  /** Hairline / ring color for elements on artwork (status dot ring, back btn). */
  mediaBorder: 'rgba(7,7,12,0.55)',
  /** Transparent → solid scrims, for gradient stops. */
  scrim: 'rgba(7,7,12,0.0)',
  scrimStrong: 'rgba(7,7,12,0.92)',
} as const;

/** Bottom-up scrim placed over poster art so text stays legible. Constant. */
const POSTER_GRADIENT = ['rgba(7,7,12,0)', 'rgba(7,7,12,0.55)', 'rgba(7,7,12,0.96)'] as const;

// ---------------------------------------------------------------------------
// Per-theme color "chrome" — surfaces, text and accents that flip per theme.
// ---------------------------------------------------------------------------

interface Chrome {
  // Backgrounds
  bg: string;
  bgDeep: string;
  surface: string;
  surfaceElevated: string;
  surfaceHigh: string;
  // Hairlines / borders
  border: string;
  borderStrong: string;
  // Text
  text: string;
  textMuted: string;
  textFaint: string;
  textDisabled: string;
  // Brand
  accent: string;
  /** A softer accent for secondary text/emphasis — LIGHTER than `accent` on
   *  dark themes, DARKER on light themes, so it always reads on `surface`. */
  accentSoft: string;
  /** A second brand hue (used for the "Rewatching" status). */
  accentAlt: string;
  onAccent: string;
  // Feedback (also color watch statuses)
  positive: string;
  warning: string;
  danger: string;
  info: string;
  // Skeleton shimmer
  skeletonBase: string;
  skeletonHighlight: string;
}

interface GradientSet {
  /** The signature accent gradient (buttons, avatar). */
  brand: readonly [string, string];
  brandVertical: readonly [string, string];
  /** Soft top glow behind hero sections — accent fading to transparent. */
  heroGlow: readonly [string, string];
  /** Constant dark scrim over poster art. */
  poster: readonly [string, string, string];
}

const MIDNIGHT: Chrome = {
  bg: '#0B0B12',
  bgDeep: '#07070C',
  surface: '#15151F',
  surfaceElevated: '#1E1E2A',
  surfaceHigh: '#272735',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.12)',
  text: '#F5F5FA',
  textMuted: '#A4A4B8',
  textFaint: '#74748A',
  textDisabled: '#4C4C5E',
  accent: '#7C5CFF',
  accentSoft: '#9B85FF',
  accentAlt: '#C04DFF',
  onAccent: '#FFFFFF',
  positive: '#3DDC97',
  warning: '#FFB020',
  danger: '#FF5C6E',
  info: '#4DA6FF',
  skeletonBase: '#1E1E2A',
  skeletonHighlight: '#272735',
};

const ABYSS: Chrome = {
  bg: '#000000',
  bgDeep: '#000000',
  surface: '#0C0F14',
  surfaceElevated: '#131922',
  surfaceHigh: '#1D2430',
  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.13)',
  text: '#EAF1FB',
  textMuted: '#94A3B8',
  textFaint: '#5C6A7D',
  textDisabled: '#3A4453',
  accent: '#5B7CFF',
  accentSoft: '#9DB3FF',
  accentAlt: '#38E0FF',
  onAccent: '#FFFFFF',
  positive: '#34E5A0',
  warning: '#FFC24B',
  danger: '#FF6B81',
  info: '#4DA6FF',
  skeletonBase: '#131922',
  skeletonHighlight: '#1D2430',
};

const SAKURA: Chrome = {
  bg: '#150E18',
  bgDeep: '#0E080F',
  surface: '#241825',
  surfaceElevated: '#2E1F30',
  surfaceHigh: '#3B2A3D',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.13)',
  text: '#F8EEF4',
  textMuted: '#CBA9BE',
  textFaint: '#9A7E8D',
  textDisabled: '#6B5462',
  accent: '#FF6FA5',
  accentSoft: '#FF9DC1',
  accentAlt: '#C9A0FF',
  onAccent: '#2A0A18',
  positive: '#5FD6A0',
  warning: '#FFC15E',
  danger: '#FF6B81',
  info: '#B58CFF',
  skeletonBase: '#2E1F30',
  skeletonHighlight: '#3B2A3D',
};

const COZY: Chrome = {
  bg: '#F4EEE4',
  bgDeep: '#EAE1D3',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHigh: '#E9DFCF',
  border: 'rgba(74,54,38,0.10)',
  borderStrong: 'rgba(74,54,38,0.18)',
  text: '#3B3027',
  textMuted: '#6E6053',
  textFaint: '#9E8E7D',
  textDisabled: '#BEB2A2',
  accent: '#7C5CFF',
  accentSoft: '#6A4BE0',
  accentAlt: '#C44DD9',
  onAccent: '#FFFFFF',
  positive: '#1FA873',
  warning: '#C6820C',
  danger: '#DD4A5C',
  info: '#2E7DD6',
  skeletonBase: '#E6DCCB',
  skeletonHighlight: '#F1E9DC',
};

const DAYLIGHT: Chrome = {
  bg: '#F3F5FA',
  bgDeep: '#E7ECF4',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHigh: '#E9EEF6',
  border: 'rgba(20,30,60,0.10)',
  borderStrong: 'rgba(20,30,60,0.16)',
  text: '#151B27',
  textMuted: '#515B6C',
  textFaint: '#8A93A5',
  textDisabled: '#B3BBC8',
  accent: '#5B5BF5',
  accentSoft: '#4A45D8',
  accentAlt: '#B14DE0',
  onAccent: '#FFFFFF',
  positive: '#11936A',
  warning: '#B7780F',
  danger: '#DA3B53',
  info: '#2D74E0',
  skeletonBase: '#E4EAF3',
  skeletonHighlight: '#EEF2F9',
};

/**
 * PIXEL — the retro "Pixel RPG" theme (GBA dialog-box look): powder-blue field,
 * cream panels, navy double-borders, red/blue/gold/green accents. Full-color
 * cover art still reads against it. Pairs with PIXEL_RADII/SHADOW/TYPE + retro
 * dialog-box chrome on the shared primitives.
 */
const PIXEL: Chrome = {
  bg: '#BBD2EA',
  bgDeep: '#A6C2E0',
  surface: '#F8F4E6',
  surfaceElevated: '#FFFDF4',
  surfaceHigh: '#E7DEC4',
  border: 'rgba(40,60,124,0.28)',
  borderStrong: '#283C7C',
  text: '#26305C',
  textMuted: '#54639C',
  textFaint: '#8893BC',
  textDisabled: '#AEB6D0',
  accent: '#D83018',
  accentSoft: '#A8240F',
  accentAlt: '#3858C0',
  onAccent: '#FFF7E6',
  positive: '#2E9E3A',
  warning: '#C0820C',
  danger: '#C8281C',
  info: '#2E78C8',
  skeletonBase: '#E0D8C0',
  skeletonHighlight: '#EFE8D4',
};

/** The full color set a theme exposes = its chrome + the constant on-media tokens. */
export type ThemeColors = Chrome & typeof onMedia;
export type ThemeGradients = GradientSet;
export type ColorToken = keyof ThemeColors;

function buildColors(chrome: Chrome): ThemeColors {
  return { ...chrome, ...onMedia };
}

function brandGradients(
  brand: readonly [string, string],
  brandVertical: readonly [string, string],
  glowRgb: string,
): GradientSet {
  return {
    brand,
    brandVertical,
    heroGlow: [`rgba(${glowRgb},0.26)`, `rgba(${glowRgb},0)`] as const,
    poster: POSTER_GRADIENT,
  };
}

export type ThemeName = 'midnight' | 'abyss' | 'sakura' | 'cozy' | 'daylight' | 'pixel';

export interface ThemeDef {
  name: ThemeName;
  label: string;
  /** One-line flavor text shown under the name in Settings. */
  blurb: string;
  isDark: boolean;
  colors: ThemeColors;
  gradients: ThemeGradients;
  /**
   * Optional shape/type overrides. Omitted by every standard theme (they use the
   * default `radii`/`shadow`/`typography`); only the retro `pixel` theme sets
   * them — squared corners, hard shadow, pixel fonts. `retro` flips the
   * dialog-box treatment on shared primitives.
   */
  radii?: RadiiScale;
  shadow?: ShadowSet;
  type?: TypeOverride;
  retro?: boolean;
}

export const themes: Record<ThemeName, ThemeDef> = {
  midnight: {
    name: 'midnight',
    label: 'Midnight',
    blurb: 'Violet & magenta on near-black',
    isDark: true,
    colors: buildColors(MIDNIGHT),
    gradients: brandGradients(['#7C5CFF', '#FF5CA8'], ['#C04DFF', '#7C5CFF'], '124,92,255'),
  },
  abyss: {
    name: 'abyss',
    label: 'Abyss',
    blurb: 'True-black OLED, electric blue',
    isDark: true,
    colors: buildColors(ABYSS),
    gradients: brandGradients(['#5B7CFF', '#38E0FF'], ['#38E0FF', '#5B7CFF'], '91,124,255'),
  },
  sakura: {
    name: 'sakura',
    label: 'Sakura',
    blurb: 'Plum night, cherry-blossom pink',
    isDark: true,
    colors: buildColors(SAKURA),
    gradients: brandGradients(['#FF6FA5', '#FFA98A'], ['#FF6FA5', '#C9A0FF'], '255,111,165'),
  },
  cozy: {
    name: 'cozy',
    label: 'Cozy',
    blurb: 'Warm cream & soft lavender',
    isDark: false,
    colors: buildColors(COZY),
    gradients: brandGradients(['#8A6BFF', '#FF6FA5'], ['#8A6BFF', '#C44DD9'], '124,92,255'),
  },
  daylight: {
    name: 'daylight',
    label: 'Daylight',
    blurb: 'Crisp white, indigo & teal',
    isDark: false,
    colors: buildColors(DAYLIGHT),
    gradients: brandGradients(['#5B5BF5', '#2BB7D4'], ['#5B5BF5', '#B14DE0'], '91,91,245'),
  },
  pixel: {
    name: 'pixel',
    label: 'Pixel RPG',
    blurb: 'Game Boy dialog boxes & pixel type',
    isDark: false,
    colors: buildColors(PIXEL),
    // Near-flat brand pair so gradient surfaces read as solid retro fills.
    gradients: brandGradients(['#D83018', '#E0482C'], ['#3858C0', '#2E78C8'], '216,48,24'),
    radii: PIXEL_RADII,
    shadow: PIXEL_SHADOW,
    type: PIXEL_TYPE,
    retro: true,
  },
};

/** Ordered list for the theme gallery (darks first, then lights). */
export const THEME_LIST: ThemeDef[] = [
  themes.midnight,
  themes.abyss,
  themes.sakura,
  themes.cozy,
  themes.daylight,
  themes.pixel,
];

export const DEFAULT_THEME: ThemeName = 'midnight';

/** Used by the pre-hydration splash, before the provider resolves a theme. */
export const splashColor = themes[DEFAULT_THEME].colors.bg;
