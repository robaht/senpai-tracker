import AsyncStorage from '@react-native-async-storage/async-storage';
import { displayTitle, getAnimeById, type Media } from '../../api/anilist';
import { useTrackingStore } from '../tracking/store';
import { snapshotRepository } from './snapshotRepository';
import { useNotificationStore } from './store';
import type { AppNotification, NotificationSnapshot } from './types';

/** Don't hammer AniList on every foreground/HMR reload during dev. */
const THROTTLE_MS = 15 * 60 * 1000;
/** Worst-case AniList calls per run, well under the ~90 req/min budget (F7/F8). */
const MAX_FAN_OUT = 40;
/** Small concurrent batches so one slow/failing id doesn't block the rest. */
const FETCH_CHUNK_SIZE = 5;

const META_KEY = 'senpai:notification-meta:v1';

interface NotificationMeta {
  lastGlobalCheckAt: number;
}

/**
 * One small piece of global meta (the last global detection run timestamp,
 * used for the throttle above) — not worth a full repository class for a
 * single field, so it's read/written here directly via AsyncStorage.
 */
async function getLastGlobalCheckAt(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) return 0;
    return (JSON.parse(raw) as NotificationMeta).lastGlobalCheckAt ?? 0;
  } catch {
    return 0;
  }
}

async function setLastGlobalCheckAt(ts: number): Promise<void> {
  const meta: NotificationMeta = { lastGlobalCheckAt: ts };
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
}

// Actively-following statuses — "new episode" has meaning for these. Not
// PLANNING/DROPPED, and not COMPLETED (a finished watch has no "new episode").
const EPISODE_STATUSES = new Set(['CURRENT', 'REPEATING', 'PAUSED']);

function emptySnapshot(mediaId: number): NotificationSnapshot {
  return { mediaId, releasedEpisodes: 0, knownSequelIds: [], initialized: false, lastCheckedAt: 0 };
}

/**
 * Episodes strictly before the next-to-air one are released; for
 * finished/no-more-airing titles, all known episodes are released.
 */
function releasedEpisodesOf(media: Media): number {
  if (media.nextAiringEpisode) return media.nextAiringEpisode.episode - 1;
  return media.episodes ?? 0;
}

function sequelIdsOf(media: Media): number[] {
  return (media.relations ?? [])
    .filter((e) => e.relationType === 'SEQUEL')
    .map((e) => e.node.id);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Adds `n` via the store and reports whether it was actually new (store dedupes by id). */
function addAndCount(n: AppNotification): number {
  const before = Object.keys(useNotificationStore.getState().entries).length;
  useNotificationStore.getState().add(n);
  return Object.keys(useNotificationStore.getState().entries).length - before;
}

/**
 * Diffs one freshly-fetched `media` against its prior snapshot, emitting
 * `new-episode`/`new-season` notifications (unless this is the title's first
 * ever check — see `NotificationSnapshot.initialized`) and writing the
 * updated snapshot. Returns the number of notifications created.
 */
async function diffAndNotify(
  media: Media,
  snapshot: NotificationSnapshot,
  isEpisodeCandidate: boolean,
  isSeasonCandidate: boolean,
): Promise<number> {
  const releasedEpisodes = releasedEpisodesOf(media);
  const sequelIds = sequelIdsOf(media);
  let added = 0;

  if (snapshot.initialized) {
    const title = displayTitle(media.title);
    const coverImage = media.coverImage?.extraLarge ?? media.coverImage?.large ?? null;
    const now = Date.now();

    if (isEpisodeCandidate && releasedEpisodes > snapshot.releasedEpisodes) {
      const episodeCount = releasedEpisodes - snapshot.releasedEpisodes;
      added += addAndCount({
        id: `new-episode:${media.id}:${releasedEpisodes}`,
        type: 'new-episode',
        mediaId: media.id,
        title,
        coverImage,
        message:
          episodeCount === 1 ? `Episode ${releasedEpisodes} is out` : `${episodeCount} new episodes are out`,
        episode: releasedEpisodes,
        episodeCount,
        createdAt: now,
        read: false,
      });
    }

    if (isSeasonCandidate) {
      for (const edge of media.relations ?? []) {
        if (edge.relationType !== 'SEQUEL') continue;
        if (snapshot.knownSequelIds.includes(edge.node.id)) continue;
        const sequelTitle = displayTitle(edge.node.title);
        added += addAndCount({
          id: `new-season:${media.id}:${edge.node.id}`,
          type: 'new-season',
          mediaId: media.id,
          title,
          coverImage,
          message: `A new season of ${title} was announced: ${sequelTitle}`,
          sequelMediaId: edge.node.id,
          sequelTitle,
          createdAt: now,
          read: false,
        });
      }
    }
  }
  // First-ever check for this title: baseline silently, emit nothing.

  await snapshotRepository.upsert({
    mediaId: media.id,
    releasedEpisodes,
    knownSequelIds: sequelIds,
    initialized: true,
    lastCheckedAt: Date.now(),
  });

  return added;
}

/**
 * Diff-based, on-open notification detection: fetches a fresh AniList read
 * for each tracked candidate title and compares it against the last-seen
 * snapshot, emitting `new-episode`/`new-season` notifications on the way.
 *
 * `getAnimeById` also fetches characters/externalLinks, which this doesn't
 * need — acceptable for this pass; a leaner query is a future optimization,
 * not built here. A future stretch could also layer `expo-notifications`
 * local scheduling on top of this loop for a dev build, but that needs a dev
 * build (not Expo Go) and is explicitly out of scope for now.
 */
export async function runNotificationDetection(opts?: { force?: boolean }): Promise<{ added: number }> {
  const now = Date.now();
  if (!opts?.force) {
    const last = await getLastGlobalCheckAt();
    if (now - last < THROTTLE_MS) return { added: 0 };
  }

  const trackingEntries = useTrackingStore.getState().entries;
  const episodeCandidates = new Set<number>();
  const seasonCandidates = new Set<number>();
  for (const entry of Object.values(trackingEntries)) {
    if (EPISODE_STATUSES.has(entry.status)) episodeCandidates.add(entry.mediaId);
    else if (entry.status === 'COMPLETED') seasonCandidates.add(entry.mediaId);
  }
  // A title CURRENT for one purpose is never COMPLETED, so these sets are
  // disjoint in practice — union defensively anyway.
  const ids = new Set<number>([...episodeCandidates, ...seasonCandidates]);

  if (ids.size === 0) {
    await setLastGlobalCheckAt(now);
    return { added: 0 };
  }

  // Oldest-checked-first (no snapshot yet sorts first), capped fan-out.
  const withSnapshots = await Promise.all(
    Array.from(ids).map(async (id) => ({ id, snapshot: await snapshotRepository.get(id) })),
  );
  withSnapshots.sort((a, b) => (a.snapshot?.lastCheckedAt ?? 0) - (b.snapshot?.lastCheckedAt ?? 0));
  const selected = withSnapshots.slice(0, MAX_FAN_OUT);

  let added = 0;
  for (const batch of chunk(selected, FETCH_CHUNK_SIZE)) {
    const results = await Promise.allSettled(batch.map((s) => getAnimeById(s.id)));
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status !== 'fulfilled') continue; // swallow per-id errors, skip this run
      const media = result.value;
      const prior = batch[i].snapshot ?? emptySnapshot(media.id);
      added += await diffAndNotify(
        media,
        prior,
        episodeCandidates.has(media.id),
        seasonCandidates.has(media.id),
      );
    }
  }

  await setLastGlobalCheckAt(now);
  return { added };
}
