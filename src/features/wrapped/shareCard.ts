import { Platform, type View } from 'react-native';
import type { RefObject } from 'react';
import type { WrappedSummary } from '../stats/wrapped';

/**
 * Renders the Wrapped finale to a tall (9:16) share image and hands it to the
 * OS — `navigator.share({ files })` on supporting browsers (mobile Safari /
 * Chrome), falling back to a PNG download elsewhere.
 *
 * This is the "exportable, shareable with friends" payoff. It's drawn entirely
 * on a `<canvas>` (no view-shot dep) so the export is pixel-identical regardless
 * of screen size and looks intentional as a story/post.
 *
 * **Why no cover thumbnails in the export:** AniList's image CDN doesn't send
 * CORS headers, so cross-origin covers can't be read back off a canvas (it would
 * taint and `toBlob` would throw). The in-app story shows covers fine (plain
 * <Image>, no canvas), but the export leans on each show's stored `coverColor`
 * (plain hex, no network) to stay personal — a "palette of your year" plus title
 * callouts. Native (no canvas) returns `unsupported`; a future dev build can add
 * react-native-view-shot to capture the real card with covers.
 */

export type ShareResult = 'shared' | 'downloaded' | 'unsupported' | 'error';

export interface SharePalette {
  from: string;
  to: string;
  accent: string;
}

const W = 1080;
const H = 1920;
const PAD = 96;
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.72)';
const FAINT = 'rgba(255,255,255,0.5)';

// `_shareRef` keeps the signature identical to the native build (which captures
// a rendered view); the web canvas path draws from data and ignores it.
export async function shareWrapped(
  summary: WrappedSummary,
  palette: SharePalette,
  _shareRef?: RefObject<View | null>,
): Promise<ShareResult> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return 'unsupported';

  try {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'unsupported';

    drawCard(ctx, summary, palette);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
    if (!blob) return 'error';

    const fileName = `senpai-wrapped-${summary.year}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({
        files: [file],
        title: `My ${summary.year} Anime Wrapped`,
        text: `My ${summary.year} in anime, wrapped by Senpai 🎴`,
      });
      return 'shared';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
    console.warn('[wrapped] share failed', err);
    return 'error';
  }
}

function drawCard(ctx: CanvasRenderingContext2D, s: WrappedSummary, palette: SharePalette) {
  // Background gradient + a soft accent glow for depth.
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, palette.from);
  bg.addColorStop(1, palette.to);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, H * 0.12, 0, W * 0.85, H * 0.12, W * 0.9);
  glow.addColorStop(0, withAlpha(palette.accent, 0.5));
  glow.addColorStop(1, withAlpha(palette.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'alphabetic';

  // Header.
  ctx.fillStyle = MUTED;
  spacedText(ctx, 'SENPAI', PAD, 150, '700 34px sans-serif', 8);
  ctx.fillStyle = WHITE;
  ctx.font = '800 132px sans-serif';
  ctx.fillText(String(s.year), PAD, 300);
  ctx.fillStyle = palette.accent;
  ctx.font = '800 96px sans-serif';
  ctx.fillText('WRAPPED', PAD, 410);

  // Big stat trio.
  const stats: Array<[string, string]> = [
    [fmt(s.episodes), 'episodes'],
    [fmt(s.hours), s.hoursEstimated ? 'hours (≈)' : 'hours'],
    [fmt(s.completed), 'completed'],
  ];
  let y = 600;
  for (const [value, label] of stats) {
    ctx.fillStyle = WHITE;
    ctx.font = '800 108px sans-serif';
    ctx.fillText(value, PAD, y);
    const vw = ctx.measureText(value).width;
    ctx.fillStyle = MUTED;
    ctx.font = '600 40px sans-serif';
    ctx.fillText(label, PAD + vw + 28, y - 12);
    y += 150;
  }

  // Top picks — favorite + most binged, dotted with their cover color.
  let py = 1110;
  ctx.fillStyle = FAINT;
  spacedText(ctx, 'TOP PICKS', PAD, py, '700 30px sans-serif', 4);
  py += 70;
  const picks: Array<{ title: string; meta: string; color: string | null } | null> = [
    s.topRated ? { title: s.topRated.title, meta: `★ ${s.topRated.value}`, color: s.topRated.coverColor } : null,
    s.mostBinged && s.mostBinged.mediaId !== s.topRated?.mediaId
      ? { title: s.mostBinged.title, meta: `${s.mostBinged.value} eps`, color: s.mostBinged.coverColor }
      : null,
  ];
  for (const p of picks) {
    if (!p) continue;
    const dot = p.color ?? palette.accent;
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(PAD + 16, py - 16, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.accent;
    ctx.font = '800 44px sans-serif';
    const metaW = ctx.measureText(p.meta).width;
    ctx.fillText(p.meta, W - PAD - metaW, py);
    ctx.fillStyle = WHITE;
    ctx.font = '700 48px sans-serif';
    const title = truncate(ctx, p.title, W - PAD * 2 - 60 - metaW - 30);
    ctx.fillText(title, PAD + 56, py);
    py += 86;
  }

  // Palette of the year — a swatch strip from each show's cover color.
  const swatches = s.covers.map((c) => c.coverColor).filter((c): c is string => !!parseHex(c));
  if (swatches.length >= 3) {
    py += 30;
    ctx.fillStyle = FAINT;
    spacedText(ctx, 'YOUR PALETTE', PAD, py, '700 30px sans-serif', 4);
    py += 46;
    const cols = Math.min(swatches.length, 9);
    const gap = 16;
    const size = (W - PAD * 2 - gap * (cols - 1)) / cols;
    swatches.slice(0, cols).forEach((color, i) => {
      roundRect(ctx, PAD + i * (size + gap), py, size, size, 18);
      ctx.fillStyle = color;
      ctx.fill();
    });
    py += size;
  }

  // Archetype card.
  const archY = 1590;
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  roundRect(ctx, PAD, archY, W - PAD * 2, 200, 36);
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.font = '800 88px sans-serif';
  ctx.fillText(s.archetype.emoji, PAD + 48, archY + 128);
  ctx.fillStyle = MUTED;
  ctx.font = '700 30px sans-serif';
  ctx.fillText('YOUR ANIME PERSONALITY', PAD + 172, archY + 78);
  ctx.fillStyle = WHITE;
  ctx.font = '800 56px sans-serif';
  ctx.fillText(truncate(ctx, s.archetype.name, W - PAD * 2 - 200), PAD + 172, archY + 146);

  // Footer.
  const topGenre = s.topGenres[0]?.key;
  ctx.fillStyle = MUTED;
  ctx.font = '600 36px sans-serif';
  ctx.fillText(
    topGenre ? `Top genre · ${topGenre}   ·   ${fmt(s.titles)} titles` : `${fmt(s.titles)} titles tracked`,
    PAD,
    H - 80,
  );
}

// --- canvas helpers ---

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Truncate text with an ellipsis to fit maxWidth at the current font. */
function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** Draw text with manual letter-spacing (canvas has no native tracking). */
function spacedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, spacing: number) {
  ctx.font = font;
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

function parseHex(color: string | null): string | null {
  if (!color) return null;
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color.trim()) ? color.trim() : null;
}

function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const fmt = (n: number) => n.toLocaleString();
