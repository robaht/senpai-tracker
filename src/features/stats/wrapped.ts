import { useMemo } from 'react';
import { useTrackingStore } from '../tracking/store';
import { STATUS_META, WATCH_STATUSES, type TrackEntry, type WatchStatus } from '../tracking/types';
import { FALLBACK_EPISODE_MINUTES, type Count } from './index';

/**
 * "Anime Wrapped" — a seasonal, narrative year-in-review derived from the same
 * tracked list F14's stats dashboard reads. Where `deriveStats` powers an
 * always-on reference dashboard, this shapes the data into a handful of headline
 * beats meant to be swiped through and shared.
 *
 * Everything here is pure + offline. The only caveat (shared with F14): the
 * `TrackEntry` snapshot may lack `duration`/`genres` for older entries, so hours
 * and the genre mix are best-effort estimates — surfaced via `hoursEstimated`.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** A title surfaced on a story card, with just enough to render its poster. */
export interface WrappedTitle {
  mediaId: number;
  title: string;
  coverImage: string | null;
  coverColor: string | null;
  /** The headline number for this title's card (score, episodes, …). */
  value: number;
}

/** A taste "personality" derived from the year's genre mix. */
export interface WrappedArchetype {
  name: string;
  emoji: string;
  blurb: string;
}

export interface WrappedSummary {
  year: number;
  /** Titles touched in the period. */
  titles: number;
  /** Whether there's enough watched to tell a real story. */
  hasEnough: boolean;
  completed: number;
  episodes: number;
  hours: number;
  hoursEstimated: boolean;
  meanScore: number;
  scoredCount: number;
  topGenres: Count[];
  statusBreakdown: Count<WatchStatus>[];
  /** Highest-scored title of the year (the "favorite"). */
  topRated: WrappedTitle | null;
  /** Title with the most episodes watched (the "binge"). */
  mostBinged: WrappedTitle | null;
  busiestMonth: { label: string; count: number } | null;
  archetype: WrappedArchetype;
  /** Every watched title that has cover art, best-first — powers the cover wall. */
  covers: WrappedTitle[];
}

/** Min entries before we promise a full story rather than a gentle empty state. */
export const WRAPPED_MIN_TITLES = 3;

const inYear = (ms: number, year: number) =>
  new Date(ms).getFullYear() === year;

/** Years (desc) that have at least one tracked entry, for the year picker. */
export function wrappedYears(entries: TrackEntry[]): number[] {
  const set = new Set<number>();
  for (const e of entries) set.add(new Date(e.updatedAt).getFullYear());
  return [...set].sort((a, b) => b - a);
}

/**
 * Maps the year's dominant genre to a playful "anime personality". Falls back
 * to status-flavored archetypes when genre data is thin (older snapshots).
 */
function deriveArchetype(
  topGenres: Count[],
  status: Map<WatchStatus, number>,
  completed: number,
  total: number,
): WrappedArchetype {
  const top = topGenres[0]?.key;
  const byGenre: Record<string, WrappedArchetype> = {
    Romance: { name: 'The Hopeless Romantic', emoji: '💞', blurb: 'You came for the slow-burn glances and stayed for the confession arc.' },
    Action: { name: 'The Adrenaline Seeker', emoji: '⚔️', blurb: 'No fight scene too long, no power-up too loud. You live for the clash.' },
    Comedy: { name: 'The Good-Vibes Curator', emoji: '😆', blurb: 'Life is short, your watchlist is funny. Comfort over carnage.' },
    Fantasy: { name: 'The Worldbuilder', emoji: '🐉', blurb: 'Maps, magic systems, and a soft spot for a well-named kingdom.' },
    Adventure: { name: 'The Wanderer', emoji: '🧭', blurb: 'Always one more island, one more arc, one more horizon.' },
    Drama: { name: 'The Feelings Connoisseur', emoji: '🎭', blurb: 'You watch with tissues in reach and regret nothing.' },
    'Sci-Fi': { name: 'The Futurist', emoji: '🛰️', blurb: 'Mechs, timelines, and questions about what makes us human.' },
    'Slice of Life': { name: 'The Cozy Soul', emoji: '🍵', blurb: 'Quiet afternoons, gentle stories, a warm cup nearby.' },
    Horror: { name: 'The Thrill Chaser', emoji: '👁️', blurb: 'You like the lights low and the tension high.' },
    Mystery: { name: 'The Detective', emoji: '🔎', blurb: 'You called the twist three episodes early and you know it.' },
    Supernatural: { name: 'The Mystic', emoji: '🔮', blurb: 'Spirits, curses, and the thin line between worlds.' },
    Psychological: { name: 'The Overthinker', emoji: '🧠', blurb: 'The mind games are the main event. You take notes.' },
    Sports: { name: 'The Team Captain', emoji: '🏆', blurb: 'You believe in the power of friendship and a good training montage.' },
    Music: { name: 'The Melodist', emoji: '🎶', blurb: 'Every great arc has a soundtrack, and you know every word.' },
    Ecchi: { name: 'The Connoisseur', emoji: '😳', blurb: 'No judgment here. You watch what you watch.' },
    Mecha: { name: 'The Pilot', emoji: '🤖', blurb: 'Big robots, bigger feelings. You buckle in every time.' },
    Thriller: { name: 'The Edge-Sitter', emoji: '🌀', blurb: 'You binge in one sitting because stopping is not an option.' },
  };
  if (top && byGenre[top]) return byGenre[top];

  // Status-flavored fallbacks when genre data is sparse.
  const dropped = status.get('DROPPED') ?? 0;
  const planning = status.get('PLANNING') ?? 0;
  if (total > 0 && completed / total >= 0.75) {
    return { name: 'The Completionist', emoji: '✅', blurb: 'You finish what you start. Loose ends do not survive your watchlist.' };
  }
  if (planning > completed) {
    return { name: 'The Dreamer', emoji: '🌙', blurb: 'Your plan-to-watch pile is a love letter to your future self.' };
  }
  if (dropped >= 3) {
    return { name: 'The Free Spirit', emoji: '🍃', blurb: 'Life is too short for a show that lost you. You move on, guilt-free.' };
  }
  return { name: 'The Explorer', emoji: '✨', blurb: 'A little of everything — your taste refuses to be boxed in.' };
}

/** Build the year-in-review summary for a given calendar year. */
export function computeWrapped(entries: TrackEntry[], year: number): WrappedSummary {
  const scoped = entries.filter((e) => inYear(e.updatedAt, year));

  let episodes = 0;
  let minutes = 0;
  let hoursEstimated = false;
  let completed = 0;
  let scoreSum = 0;
  let scoredCount = 0;

  const statusCounts = new Map<WatchStatus, number>();
  const genreCounts = new Map<string, number>();
  const monthCounts = new Array(12).fill(0) as number[];

  let topRated: WrappedTitle | null = null;
  let mostBinged: WrappedTitle | null = null;

  for (const e of scoped) {
    episodes += e.progress;
    const perEp = e.duration ?? FALLBACK_EPISODE_MINUTES;
    if (e.duration == null && e.progress > 0) hoursEstimated = true;
    minutes += e.progress * perEp;

    statusCounts.set(e.status, (statusCounts.get(e.status) ?? 0) + 1);
    if (e.status === 'COMPLETED') completed += 1;

    for (const g of e.genres ?? []) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);

    monthCounts[new Date(e.updatedAt).getMonth()] += 1;

    if (e.score > 0) {
      scoreSum += e.score;
      scoredCount += 1;
      if (!topRated || e.score > topRated.value) {
        topRated = titleOf(e, e.score);
      }
    }

    if (e.progress > 0 && (!mostBinged || e.progress > mostBinged.value)) {
      mostBinged = titleOf(e, e.progress);
    }
  }

  const topGenres: Count[] = [...genreCounts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, 5);

  const statusBreakdown: Count<WatchStatus>[] = WATCH_STATUSES.filter(
    (s) => (statusCounts.get(s) ?? 0) > 0,
  ).map((s) => ({ key: s, count: statusCounts.get(s) as number }));

  // Cover wall: every title with art, scored-best first, then most-watched.
  const covers: WrappedTitle[] = scoped
    .filter((e) => !!e.coverImage)
    .sort((a, b) => b.score - a.score || b.progress - a.progress)
    .map((e) => titleOf(e, e.score || e.progress));

  let busiestMonth: WrappedSummary['busiestMonth'] = null;
  const peak = Math.max(0, ...monthCounts);
  if (peak > 0) {
    const idx = monthCounts.indexOf(peak);
    busiestMonth = { label: MONTHS[idx], count: peak };
  }

  return {
    year,
    titles: scoped.length,
    hasEnough: scoped.length >= WRAPPED_MIN_TITLES,
    completed,
    episodes,
    hours: Math.round(minutes / 60),
    hoursEstimated,
    meanScore: scoredCount ? scoreSum / scoredCount : 0,
    scoredCount,
    topGenres,
    statusBreakdown,
    topRated,
    mostBinged,
    busiestMonth,
    archetype: deriveArchetype(topGenres, statusCounts, completed, scoped.length),
    covers,
  };
}

function titleOf(e: TrackEntry, value: number): WrappedTitle {
  return {
    mediaId: e.mediaId,
    title: e.title,
    coverImage: e.coverImage,
    coverColor: e.coverColor,
    value,
  };
}

/** A short, human label for the status (reuses the canonical meta). */
export function statusLabel(status: WatchStatus): string {
  return STATUS_META[status].label;
}

/** Reactive Wrapped summary for a given year, derived from the live list. */
export function useWrapped(year: number): WrappedSummary {
  const entries = useTrackingStore((s) => s.entries);
  return useMemo(() => computeWrapped(Object.values(entries), year), [entries, year]);
}

/** Reactive list of years that have tracked activity (desc). */
export function useWrappedYears(): number[] {
  const entries = useTrackingStore((s) => s.entries);
  return useMemo(() => wrappedYears(Object.values(entries)), [entries]);
}
