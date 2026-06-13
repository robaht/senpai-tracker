import { create } from 'zustand';
import { displayTitle, type Media } from '../../api/anilist';
import { trackingRepository } from './repository';
import type { TrackEntry, WatchStatus } from './types';

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
}

function snapshotFromMedia(media: Media): Pick<
  TrackEntry,
  'title' | 'coverImage' | 'coverColor' | 'format' | 'totalEpisodes'
> {
  return {
    title: displayTitle(media.title),
    coverImage: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    coverColor: media.coverImage?.color ?? null,
    format: media.format ?? null,
    totalEpisodes: media.episodes ?? null,
  };
}

/** Every mutation persists through the repository, then reflects in memory. */
export const useTrackingStore = create<TrackingState>((set, get) => {
  // Fire-and-forget persistence keeps the UI snappy; the in-memory state is the
  // source of truth for rendering, the repository for durability.
  const persist = (entry: TrackEntry) => {
    void trackingRepository.upsert(entry);
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
      set((s) => {
        const next = { ...s.entries };
        delete next[mediaId];
        return { entries: next };
      });
      void trackingRepository.remove(mediaId);
    },

    setStatus: (mediaId, status) => update(mediaId, { status }),

    setProgress: (mediaId, progress) => {
      const entry = get().entries[mediaId];
      if (!entry) return;
      const max = entry.totalEpisodes ?? Number.MAX_SAFE_INTEGER;
      update(mediaId, { progress: Math.max(0, Math.min(progress, max)) });
    },

    incrementProgress: (mediaId) => {
      const entry = get().entries[mediaId];
      if (!entry) return;
      get().setProgress(mediaId, entry.progress + 1);
    },

    setScore: (mediaId, score) => update(mediaId, { score: Math.max(0, Math.min(score, 10)) }),
  };
});

// ---- Selector hooks (stable, render-optimized reads) ----

export function useTrackEntry(mediaId: number): TrackEntry | undefined {
  return useTrackingStore((s) => s.entries[mediaId]);
}

export function useIsTracked(mediaId: number): boolean {
  return useTrackingStore((s) => !!s.entries[mediaId]);
}
