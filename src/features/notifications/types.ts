/**
 * "New episode" / "new season" alerts for tracked titles, computed locally by
 * diffing a fresh AniList fetch against the last-seen snapshot per title (see
 * `detect.ts`). Everything here is client-side — no push infra, no backend.
 */
export type NotificationType = 'new-episode' | 'new-season';

export interface AppNotification {
  id: string; // dedupe key, see below — also the React key / storage key
  type: NotificationType;
  mediaId: number; // the tracked title this notification is about
  title: string; // display title of mediaId, snapshotted at detection time
  coverImage: string | null;
  message: string; // precomputed human-readable string, e.g. "Episode 12 is out"
  // new-episode only:
  episode?: number; // the latest released episode number as of this detection
  episodeCount?: number; // how many new episodes since the last check (>= 1)
  // new-season only:
  sequelMediaId?: number; // the newly discovered SEQUEL relation's media id
  sequelTitle?: string;
  createdAt: number; // epoch ms, when detection created this row
  read: boolean;
}

/**
 * Dedupe key for `AppNotification.id`:
 * `${type}:${mediaId}:${type === 'new-episode' ? episode : sequelMediaId}`.
 * Because it's derived from state that only ever moves forward (episode count
 * increases, sequel ids are only added), the same event can never produce two
 * ids — the store/repository still double-check `id` doesn't already exist
 * before adding, rather than trusting the caller.
 */

export interface NotificationSnapshot {
  mediaId: number;
  /** Episodes confirmed released as of the last check (see algorithm below). */
  releasedEpisodes: number;
  /** SEQUEL relation node ids already seen for this title. */
  knownSequelIds: number[];
  /** False until the first detection pass for this title completes — while
   * false, that pass only seeds the snapshot and emits nothing (prevents a
   * notification flood for a user's whole pre-existing list on first run). */
  initialized: boolean;
  lastCheckedAt: number; // epoch ms
}
