import {
  deleteMediaListEntry,
  getMyAnimeList,
  saveMediaListEntry,
  type MediaListStatus,
  type MyListEntry,
  type ScoreFormat,
} from '../../api/anilist';
import { useAuthStore } from '../auth/store';
import { registerSyncHooks, snapshotFromMedia, useTrackingStore } from './store';
import { useSyncStore } from './syncStore';
import type { TrackEntry, WatchStatus } from './types';

/**
 * AniList list sync (F1, Phase 2). Layered on top of the local-first store: edits
 * persist locally and are pushed to AniList fire-and-forget; on sign-in (and each
 * authed app-start) the remote list is pulled and reconciled (last-write-wins).
 *
 * The tracking store doesn't import this module — it exposes `registerSyncHooks`,
 * which we call at the bottom — so there's no circular dependency.
 */

/** The active session, or null when signed out (pushes/pulls then no-op). */
function session() {
  const { status, viewer } = useAuthStore.getState();
  return status === 'signedIn' && viewer ? viewer : null;
}

/** Our internal POINT_10 score → the viewer's configured AniList score format. */
export function toRemoteScore(score: number, format: ScoreFormat): number {
  switch (format) {
    case 'POINT_100':
      return Math.round(score * 10);
    case 'POINT_5':
      return Math.round(score / 2);
    case 'POINT_3':
      if (score <= 0) return 0;
      if (score <= 3) return 1;
      if (score <= 6) return 2;
      return 3;
    default: // POINT_10 / POINT_10_DECIMAL — already 0–10
      return score;
  }
}

/** Map a pulled AniList entry to a local `TrackEntry` (carrying its remoteId). */
export function remoteToTrackEntry(e: MyListEntry): TrackEntry {
  return {
    mediaId: e.media.id,
    status: e.status as WatchStatus,
    progress: e.progress,
    score: Math.max(0, Math.min(e.score, 10)),
    ...snapshotFromMedia(e.media),
    updatedAt: e.updatedAt,
    createdAt: e.createdAt,
    remoteId: e.remoteId,
  };
}

export interface ReconcileResult {
  /** The full set to write into the store (replace). */
  merged: TrackEntry[];
  /** Entries to push up to AniList (local-only or local-newer). */
  toPush: TrackEntry[];
}

/**
 * Merge local and remote lists by media id, last-write-wins on `updatedAt`.
 * Pure (no I/O) so it's unit-testable. Remote entries carry `remoteId`; when a
 * local edit wins we keep the remote's `remoteId` so a later delete still works.
 */
export function reconcile(local: TrackEntry[], remote: TrackEntry[]): ReconcileResult {
  const byId = new Map<number, TrackEntry>();
  for (const r of remote) byId.set(r.mediaId, r);

  const toPush: TrackEntry[] = [];
  for (const l of local) {
    const r = byId.get(l.mediaId);
    if (!r) {
      byId.set(l.mediaId, l); // local-only → keep + upload
      toPush.push(l);
    } else if (l.updatedAt > r.updatedAt) {
      const merged: TrackEntry = { ...l, remoteId: r.remoteId };
      byId.set(l.mediaId, merged); // local newer → keep, keep remoteId, push update
      toPush.push(merged);
    } else {
      // remote newer/equal → keep remote, but preserve the earliest createdAt
      byId.set(l.mediaId, { ...r, createdAt: Math.min(r.createdAt, l.createdAt) });
    }
  }
  return { merged: [...byId.values()], toPush };
}

/** Upsert one entry to AniList; records the returned remoteId. No-op if signed out. */
async function pushUpsert(entry: TrackEntry): Promise<void> {
  const viewer = session();
  if (!viewer) return;
  try {
    const remoteId = await saveMediaListEntry({
      mediaId: entry.mediaId,
      status: entry.status as MediaListStatus,
      progress: entry.progress,
      score: toRemoteScore(entry.score, viewer.scoreFormat),
    });
    if (remoteId) useTrackingStore.getState().setRemoteId(entry.mediaId, remoteId);
  } catch (err) {
    console.warn('[sync] push upsert failed', err);
  }
}

/** Delete one entry on AniList. No-op if signed out or never synced (no remoteId). */
async function pushRemove(entry: TrackEntry): Promise<void> {
  const viewer = session();
  if (!viewer || !entry.remoteId) return;
  try {
    await deleteMediaListEntry(entry.remoteId);
  } catch (err) {
    console.warn('[sync] push remove failed', err);
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** ~85 req/min — under AniList's ~90/min cap; 429s still auto-retry in the client. */
const PUSH_INTERVAL_MS = 700;

/**
 * Pull the viewer's AniList list and reconcile it with the local list, then push
 * up anything local-only or local-newer. Run on sign-in, each authed app-start,
 * and from the manual "Sync now" button. Overlap-guarded via the sync store.
 */
export async function pullAndReconcile(): Promise<void> {
  const viewer = session();
  const sync = useSyncStore.getState();
  if (!viewer || sync.syncing) return;
  sync.setSyncing(true);
  try {
    const remote = (await getMyAnimeList(viewer.id)).map(remoteToTrackEntry);
    const local = Object.values(useTrackingStore.getState().entries);
    const { merged, toPush } = reconcile(local, remote);
    useTrackingStore.getState().restoreEntries(merged, 'replace');
    // Sequential + paced so a big first-login upload doesn't trip the rate limit
    // and silently drop entries (429s also auto-retry in anilistRequest).
    for (let i = 0; i < toPush.length; i++) {
      await pushUpsert(toPush[i]);
      if (i < toPush.length - 1) await sleep(PUSH_INTERVAL_MS);
    }
    useSyncStore.getState().markSynced();
  } catch (err) {
    console.warn('[sync] pull/reconcile failed', err);
    useSyncStore.getState().setSyncing(false);
  }
}

// Wire push-on-edit into the tracking store (once, at module load).
registerSyncHooks({ pushUpsert, pushRemove });
