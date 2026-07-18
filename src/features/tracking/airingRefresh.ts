import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMediaForDetection } from '../../api/anilist';
import { useTrackingStore } from './store';
import type { TrackEntry } from './types';

/** Same cadence as notification detection — don't hammer AniList on reloads. */
const THROTTLE_MS = 15 * 60 * 1000;
/** One batched request — must stay ≤ 50 so it fits a single AniList page. */
const MAX_FAN_OUT = 50;

const META_KEY = 'senpai:airing-refresh:v1';

async function getLastRefreshAt(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) return 0;
    return (JSON.parse(raw) as { lastRefreshAt: number }).lastRefreshAt ?? 0;
  } catch {
    return 0;
  }
}

async function setLastRefreshAt(ts: number): Promise<void> {
  await AsyncStorage.setItem(META_KEY, JSON.stringify({ lastRefreshAt: ts }));
}

/**
 * An entry whose airing state can still change: never-snapshotted (pre-feature
 * entries), waiting to premiere, currently airing, or on hiatus (can resume).
 * FINISHED/CANCELLED are terminal — no point re-fetching them forever.
 */
export function isAiringRefreshCandidate(entry: TrackEntry): boolean {
  if (entry.airingStatus === undefined || entry.airingStatus === null) return true;
  return (
    entry.airingStatus === 'NOT_YET_RELEASED' ||
    entry.airingStatus === 'RELEASING' ||
    entry.airingStatus === 'HIATUS'
  );
}

/**
 * Throttled, single-request refresh of airing state for the whole library —
 * powers the "Not yet aired" / "Airing · Ep N" badges. Piggybacks on the
 * detection batch query (status + nextAiringEpisode are in MediaFields), and
 * must stay one request per run: AniList's budget is ~30 req/min and per-title
 * fan-outs have starved visible screens before (see runNotificationDetection).
 */
export async function runAiringRefresh(opts?: { force?: boolean }): Promise<{ refreshed: number }> {
  const now = Date.now();
  if (!opts?.force) {
    const last = await getLastRefreshAt();
    if (now - last < THROTTLE_MS) return { refreshed: 0 };
  }

  const entries = Object.values(useTrackingStore.getState().entries);
  // Never-snapshotted entries first — they have no badge data at all yet.
  const candidates = entries
    .filter(isAiringRefreshCandidate)
    .sort((a, b) => Number(a.airingStatus != null) - Number(b.airingStatus != null))
    .slice(0, MAX_FAN_OUT);

  if (candidates.length === 0) {
    await setLastRefreshAt(now);
    return { refreshed: 0 };
  }

  let medias;
  try {
    medias = await getMediaForDetection(candidates.map((c) => c.mediaId));
  } catch {
    // Offline or throttled: don't stamp the run, so the next app open retries.
    return { refreshed: 0 };
  }

  useTrackingStore.getState().applyAiringRefresh(medias);
  await setLastRefreshAt(now);
  return { refreshed: medias.length };
}
