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

export function snapshotFromMedia(media: Media): Pick<
  TrackEntry,
  'title' | 'coverImage' | 'coverColor' | 'format' | 'totalEpisodes' | 'duration' | 'genres'
> {
  return {
    title: displayTitle(media.title),
    coverImage: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    coverColor: media.coverImage?.color ?? null,
    format: media.format ?? null,
    totalEpisodes: media.episodes ?? null,
    duration: media.duration ?? null,
    genres: media.genres ?? [],
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
      const max = entry.totalEpisodes ?? Number.MAX_SAFE_INTEGER;
      const clamped = Math.max(0, Math.min(progress, max));
      // Auto-promote Plan-to-watch → Watching on the first logged episode. Only
      // the forward PLANNING→CURRENT step; any other status is left untouched,
      // and dropping back to 0 never reverts (entry is no longer PLANNING).
      const promote = entry.status === 'PLANNING' && clamped > 0;
      update(mediaId, promote ? { progress: clamped, status: 'CURRENT' } : { progress: clamped });
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
