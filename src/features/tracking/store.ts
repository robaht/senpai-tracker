import { create } from 'zustand';
import { displayTitle, type ImportedListEntry, type Media } from '../../api/anilist';
import { trackingRepository } from './repository';
import type { TrackEntry, WatchStatus } from './types';

/** Outcome of an import, surfaced to the user. */
export interface ImportSummary {
  /** Titles new to the local list. */
  added: number;
  /** Existing titles overwritten because the imported copy was newer. */
  updated: number;
  /** Existing titles left as-is (local copy was newer, or replace mode). */
  unchanged: number;
  /** Total titles in the imported list. */
  total: number;
}

export type ImportMode = 'merge' | 'replace';

interface TrackingState {
  entries: Record<number, TrackEntry>;
  hydrated: boolean;

  /** Load persisted entries into memory. Call once at app start. */
  hydrate: () => Promise<void>;

  /** Add a media to the list (or update its status if already tracked). */
  track: (media: Media, status: WatchStatus) => void;
  untrack: (mediaId: number) => void;
  setStatus: (mediaId: number, status: WatchStatus) => void;
  setProgress: (mediaId: number, progress: number) => void;
  incrementProgress: (mediaId: number) => void;
  setScore: (mediaId: number, score: number) => void;

  /**
   * Bulk-import a list (e.g. from an AniList username). `merge` keeps whichever
   * copy is newer per title (last-write-wins by `updatedAt`, the same rule F1's
   * sync will use); `replace` swaps the whole list for the imported one.
   */
  importFromList: (list: ImportedListEntry[], mode: ImportMode) => ImportSummary;

  /**
   * Restore full `TrackEntry` rows from a local backup file. Unlike
   * `importFromList`, these already carry their display snapshot, so no AniList
   * resolution is needed — the same merge/replace + last-write-wins rules apply.
   */
  restoreEntries: (entries: TrackEntry[], mode: ImportMode) => ImportSummary;

  /** Record an entry's AniList `remoteId` after a sync push (no timestamp bump). */
  setRemoteId: (mediaId: number, remoteId: number) => void;
  /**
   * Fold freshly-fetched airing state (status, aired episode count, total
   * episodes, premiere) into matching entries. Background metadata only: no
   * `updatedAt` bump (would pollute "recently updated" sorting and lose
   * sync conflict resolution) and no sync push (nothing user-authored changed).
   */
  applyAiringRefresh: (medias: Media[]) => void;
  /** Drop the in-memory list (sign-out) WITHOUT clearing the persisted cache. */
  clearInMemory: () => void;
}

/**
 * Cloud-sync hooks, registered once by the sync layer at startup (F1). Kept as a
 * module-level slot so the tracking store doesn't import the sync engine (which
 * imports this store) — no circular dependency.
 */
export interface SyncHooks {
  pushUpsert: (entry: TrackEntry) => void;
  pushRemove: (entry: TrackEntry) => void;
}
let syncHooks: SyncHooks | null = null;
export function registerSyncHooks(hooks: SyncHooks | null): void {
  syncHooks = hooks;
}

/**
 * Premiere timestamp for the "Airs soon" badge — only for titles that haven't
 * started airing yet. Prefers the scheduled episode-1 air time, falling back to
 * a fully-specified start date. Null for released titles or when no date is known.
 */
export function premiereFromMedia(media: Media): number | null {
  if (media.status !== 'NOT_YET_RELEASED') return null;
  if (media.nextAiringEpisode?.airingAt) return media.nextAiringEpisode.airingAt;
  const sd = media.startDate;
  if (sd?.year && sd.month && sd.day) {
    return Math.floor(new Date(sd.year, sd.month - 1, sd.day).getTime() / 1000);
  }
  return null;
}

/**
 * Latest released episode number for an airing title — episodes strictly before
 * the next-to-air one. Null when the title isn't RELEASING or AniList has no
 * schedule for it (a count would be a guess).
 */
export function airedEpisodesFromMedia(media: Media): number | null {
  if (media.status !== 'RELEASING') return null;
  if (media.nextAiringEpisode) return Math.max(0, media.nextAiringEpisode.episode - 1);
  return null;
}

export function snapshotFromMedia(media: Media): Pick<
  TrackEntry,
  | 'title'
  | 'coverImage'
  | 'coverColor'
  | 'format'
  | 'totalEpisodes'
  | 'duration'
  | 'genres'
  | 'premiereAt'
  | 'airingStatus'
  | 'airedEpisodes'
> {
  return {
    title: displayTitle(media.title),
    coverImage: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    coverColor: media.coverImage?.color ?? null,
    format: media.format ?? null,
    totalEpisodes: media.episodes ?? null,
    duration: media.duration ?? null,
    genres: media.genres ?? [],
    premiereAt: premiereFromMedia(media),
    airingStatus: media.status ?? null,
    airedEpisodes: airedEpisodesFromMedia(media),
  };
}

/** Every mutation persists through the repository, then reflects in memory. */
export const useTrackingStore = create<TrackingState>((set, get) => {
  // Fire-and-forget persistence keeps the UI snappy; the in-memory state is the
  // source of truth for rendering, the repository for durability.
  const persist = (entry: TrackEntry) => {
    void trackingRepository.upsert(entry);
    syncHooks?.pushUpsert(entry);
  };

  const update = (mediaId: number, patch: Partial<TrackEntry>) => {
    const existing = get().entries[mediaId];
    if (!existing) return;
    const next: TrackEntry = { ...existing, ...patch, updatedAt: Date.now() };
    set((s) => ({ entries: { ...s.entries, [mediaId]: next } }));
    persist(next);
  };

  return {
    entries: {},
    hydrated: false,

    hydrate: async () => {
      const all = await trackingRepository.getAll();
      const map: Record<number, TrackEntry> = {};
      for (const e of all) map[e.mediaId] = e;
      set({ entries: map, hydrated: true });
    },

    track: (media, status) => {
      const existing = get().entries[media.id];
      const now = Date.now();
      const entry: TrackEntry = existing
        ? { ...existing, status, ...snapshotFromMedia(media), updatedAt: now }
        : {
            mediaId: media.id,
            status,
            progress: 0,
            score: 0,
            ...snapshotFromMedia(media),
            createdAt: now,
            updatedAt: now,
          };
      set((s) => ({ entries: { ...s.entries, [media.id]: entry } }));
      persist(entry);
    },

    untrack: (mediaId) => {
      const removed = get().entries[mediaId];
      set((s) => {
        const next = { ...s.entries };
        delete next[mediaId];
        return { entries: next };
      });
      void trackingRepository.remove(mediaId);
      if (removed) syncHooks?.pushRemove(removed);
    },

    setStatus: (mediaId, status) => update(mediaId, { status }),

    setProgress: (mediaId, progress) => {
      const entry = get().entries[mediaId];
      if (!entry) return;
      const total = entry.totalEpisodes;
      const max = total ?? Number.MAX_SAFE_INTEGER;
      const clamped = Math.max(0, Math.min(progress, max));
      // Auto-advance status alongside progress:
      // - reaching the final episode → Completed (the whole point of logging it),
      // - first episode logged from Plan-to-watch → Watching.
      // Only ever moves status forward; any other case leaves it untouched.
      let status = entry.status;
      if (total != null && total > 0 && clamped >= total && entry.status !== 'COMPLETED') {
        status = 'COMPLETED';
      } else if (entry.status === 'PLANNING' && clamped > 0) {
        status = 'CURRENT';
      }
      update(mediaId, status !== entry.status ? { progress: clamped, status } : { progress: clamped });
    },

    incrementProgress: (mediaId) => {
      const entry = get().entries[mediaId];
      if (!entry) return;
      get().setProgress(mediaId, entry.progress + 1);
    },

    setScore: (mediaId, score) => update(mediaId, { score: Math.max(0, Math.min(score, 10)) }),

    importFromList: (list, mode) => {
      const current = get().entries;
      const next: Record<number, TrackEntry> = mode === 'replace' ? {} : { ...current };
      let added = 0;
      let updated = 0;
      let unchanged = 0;

      for (const item of list) {
        const existing = current[item.media.id];
        const incoming: TrackEntry = {
          mediaId: item.media.id,
          status: item.status,
          progress: item.progress,
          score: Math.max(0, Math.min(item.score, 10)),
          ...snapshotFromMedia(item.media),
          createdAt: existing?.createdAt ?? item.updatedAt,
          updatedAt: item.updatedAt,
        };

        if (mode === 'replace') {
          next[item.media.id] = incoming;
          added += 1;
        } else if (!existing) {
          next[item.media.id] = incoming;
          added += 1;
        } else if (item.updatedAt > existing.updatedAt) {
          next[item.media.id] = incoming;
          updated += 1;
        } else {
          unchanged += 1;
        }
      }

      set({ entries: next });
      void trackingRepository.replaceAll(Object.values(next));
      return { added, updated, unchanged, total: list.length };
    },

    restoreEntries: (entries, mode) => {
      const current = get().entries;
      const next: Record<number, TrackEntry> = mode === 'replace' ? {} : { ...current };
      let added = 0;
      let updated = 0;
      let unchanged = 0;

      for (const entry of entries) {
        const existing = current[entry.mediaId];
        if (mode === 'replace') {
          next[entry.mediaId] = entry;
          added += 1;
        } else if (!existing) {
          next[entry.mediaId] = entry;
          added += 1;
        } else if (entry.updatedAt > existing.updatedAt) {
          // Keep the original createdAt so "date added" survives a restore.
          next[entry.mediaId] = { ...entry, createdAt: existing.createdAt };
          updated += 1;
        } else {
          unchanged += 1;
        }
      }

      set({ entries: next });
      void trackingRepository.replaceAll(Object.values(next));
      return { added, updated, unchanged, total: entries.length };
    },

    applyAiringRefresh: (medias) => {
      const entries = { ...get().entries };
      let changed = false;
      for (const media of medias) {
        const existing = entries[media.id];
        if (!existing) continue;
        const patch = {
          airingStatus: media.status ?? null,
          airedEpisodes: airedEpisodesFromMedia(media),
          totalEpisodes: media.episodes ?? existing.totalEpisodes,
          premiereAt: premiereFromMedia(media),
        };
        if (
          existing.airingStatus === patch.airingStatus &&
          existing.airedEpisodes === patch.airedEpisodes &&
          existing.totalEpisodes === patch.totalEpisodes &&
          existing.premiereAt === patch.premiereAt
        ) {
          continue;
        }
        const next: TrackEntry = { ...existing, ...patch };
        entries[media.id] = next;
        changed = true;
        void trackingRepository.upsert(next);
      }
      if (changed) set({ entries });
    },

    setRemoteId: (mediaId, remoteId) => {
      const existing = get().entries[mediaId];
      if (!existing || existing.remoteId === remoteId) return;
      const next: TrackEntry = { ...existing, remoteId };
      set((s) => ({ entries: { ...s.entries, [mediaId]: next } }));
      // Persist the id but do NOT trigger a sync push (that would loop).
      void trackingRepository.upsert(next);
    },

    clearInMemory: () => set({ entries: {} }),
  };
});

// ---- Selector hooks (stable, render-optimized reads) ----

export function useTrackEntry(mediaId: number): TrackEntry | undefined {
  return useTrackingStore((s) => s.entries[mediaId]);
}

export function useIsTracked(mediaId: number): boolean {
  return useTrackingStore((s) => !!s.entries[mediaId]);
}
