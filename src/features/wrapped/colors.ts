/**
 * Color helpers that turn a show's stored `coverColor` (AniList's dominant cover
 * hue) into a tasteful, legible story gradient — so cards about a specific title
 * are literally tinted by that title's art.
 */

export interface Palette {
  from: string;
  to: string;
  accent: string;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string | null): RGB | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const toHex = ({ r, g, b }: RGB) =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/** Mix a color toward black (amt<0) or white (amt>0), |amt| in 0..1. */
function shade(c: RGB, amt: number): RGB {
  const t = amt < 0 ? 0 : 255;
  const k = Math.abs(amt);
  return { r: c.r + (t - c.r) * k, g: c.g + (t - c.g) * k, b: c.b + (t - c.b) * k };
}

/** Perceived luminance 0..1. */
function luma(c: RGB): number {
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}

/**
 * Build a deep, legible gradient from a cover color. Falls back to `fallback`
 * when the color is missing/unparseable. White foreground is assumed, so we keep
 * the gradient dark and bump the accent bright enough to pop.
 */
export function gradientFromCover(coverColor: string | null, fallback: Palette): Palette {
  const c = parseHex(coverColor);
  if (!c) return fallback;
  const from = shade(c, -0.72); // deep, near-black tint of the hue
  const to = shade(c, -0.18); // richer mid version
  // Accent: lift toward white; lift harder for very dark covers so it stays visible.
  const accent = shade(c, luma(c) < 0.35 ? 0.6 : 0.42);
  return { from: toHex(from), to: toHex(to), accent: toHex(accent) };
}
