import type { ColorToken, ThemeColors } from '../../theme/tokens';

/**
 * Watch statuses — deliberately identical to AniList's MediaListStatus enum.
 *
 * Mirroring AniList now means "sync later" (AniList OAuth or a custom backend)
 * is a field-for-field upload, not a data migration. Don't rename these.
 */
export type WatchStatus =
  | 'CURRENT' // Watching
  | 'PLANNING' // Plan to watch
  | 'COMPLETED'
  | 'PAUSED' // On hold
  | 'DROPPED'
  | 'REPEATING'; // Rewatching

/**
 * A tracked entry. Keyed by AniList `mediaId` everywhere so a future sync maps
 * 1:1 to AniList's media. We snapshot a little display data (title, cover) so
 * the Library renders instantly/offline without an extra fetch per item.
 */
export interface TrackEntry {
  mediaId: number;
  status: WatchStatus;
  /** Episodes the user has watched. */
  progress: number;
  /** Total episodes if known, for progress display. */
  totalEpisodes: number | null;
  /** User score 0–10 (0 = unscored). */
  score: number;
  // --- denormalized display snapshot ---
  title: string;
  coverImage: string | null;
  coverColor: string | null;
  format: string | null;
  // --- bookkeeping ---
  /** epoch ms — used for "recently updated" sorting and future sync conflict resolution. */
  updatedAt: number;
  createdAt: number;
}

export const WATCH_STATUSES: WatchStatus[] = [
  'CURRENT',
  'PLANNING',
  'COMPLETED',
  'PAUSED',
  'DROPPED',
  'REPEATING',
];

export const STATUS_META: Record<WatchStatus, { label: string; short: string }> = {
  CURRENT: { label: 'Watching', short: 'Watching' },
  PLANNING: { label: 'Plan to watch', short: 'Planned' },
  COMPLETED: { label: 'Completed', short: 'Done' },
  PAUSED: { label: 'On hold', short: 'Hold' },
  DROPPED: { label: 'Dropped', short: 'Dropped' },
  REPEATING: { label: 'Rewatching', short: 'Rewatch' },
};

/**
 * Maps each status to a semantic color *token*, resolved against the active
 * theme at render time via `statusColor()`. Kept as token names (not literal
 * colors) so status dots adapt to whatever theme is active.
 */
const STATUS_COLOR_TOKEN: Record<WatchStatus, ColorToken> = {
  CURRENT: 'accent',
  PLANNING: 'info',
  COMPLETED: 'positive',
  PAUSED: 'warning',
  DROPPED: 'danger',
  REPEATING: 'accentAlt',
};

/** Resolve a status's color from the active theme's palette. */
export function statusColor(colors: ThemeColors, status: WatchStatus): string {
  return colors[STATUS_COLOR_TOKEN[status]];
}
