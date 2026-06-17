import type { Media } from '../../api/anilist';
import type { TrackEntry, WatchStatus } from '../tracking/types';

/**
 * A user's taste profile: how much they like each genre, derived from their
 * tracked list. Positive = leans toward, negative = leans away. `scale` is a
 * normalizing constant (the strongest single-genre weight) so match scores read
 * on a stable 0–100 regardless of how big or opinionated the list is.
 */
export interface Affinity {
  weights: Record<string, number>;
  scale: number;
}

/** How strongly each status signals taste. Dropping something is a real signal. */
const STATUS_WEIGHT: Record<WatchStatus, number> = {
  REPEATING: 3,
  COMPLETED: 2,
  CURRENT: 1.5,
  PLANNING: 0.5,
  PAUSED: 0,
  DROPPED: -1.5,
};

/**
 * A score multiplier centered on 1: a 5/10 is neutral, higher amplifies the
 * status signal, lower dampens it. Unscored (0) stays neutral.
 */
function scoreMultiplier(score: number): number {
  if (score <= 0) return 1;
  return 0.4 + (score / 5); // 5→1.4… keeps weight positive, rewards high scores
}

/** Build a genre taste profile from the user's tracked entries. */
export function computeAffinity(entries: TrackEntry[]): Affinity {
  const weights: Record<string, number> = {};
  for (const e of entries) {
    if (e.genres.length === 0) continue;
    const w = STATUS_WEIGHT[e.status] * scoreMultiplier(e.score);
    if (w === 0) continue;
    // Spread an entry's weight across its genres so a many-genre title doesn't
    // dominate every axis at once.
    const per = w / e.genres.length;
    for (const g of e.genres) weights[g] = (weights[g] ?? 0) + per;
  }
  const scale = Math.max(1, ...Object.values(weights).map(Math.abs));
  return { weights, scale };
}

export interface MatchResult {
  /** 0–100, or null when there's no profile / no genres to judge against. */
  score: number | null;
  /** The genres (present on this title) the user leans toward most — the "why". */
  reasons: string[];
}

/**
 * How well a candidate title fits the taste profile. Sums the profile's weight
 * across the title's genres, normalizes for genre count, then maps through a
 * logistic curve to a friendly 0–100. `reasons` lists the title's genres the
 * user leans toward most, for a "because you love X" line.
 */
export function matchScore(media: Media, affinity: Affinity): MatchResult {
  const genres = media.genres ?? [];
  if (genres.length === 0 || Object.keys(affinity.weights).length === 0) {
    return { score: null, reasons: [] };
  }
  let raw = 0;
  for (const g of genres) raw += affinity.weights[g] ?? 0;
  // Normalize by sqrt(count) so breadth doesn't inflate; divide by scale so the
  // logistic input is comparable across users.
  const norm = raw / Math.sqrt(genres.length) / affinity.scale;
  const score = Math.round(100 / (1 + Math.exp(-1.6 * norm)));

  const reasons = genres
    .filter((g) => (affinity.weights[g] ?? 0) > 0)
    .sort((a, b) => (affinity.weights[b] ?? 0) - (affinity.weights[a] ?? 0))
    .slice(0, 2);

  return { score, reasons };
}
