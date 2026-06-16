import { create } from 'zustand';
import { displayTitle, type Media } from '../../api/anilist';
import { comfortRepository } from './repository';
import type { ComfortPick } from './types';

interface ComfortState {
  picks: ComfortPick[];
  hydrated: boolean;

  /** Load persisted picks into memory. Call once at app start. */
  hydrate: () => Promise<void>;

  add: (media: Media) => void;
  remove: (mediaId: number) => void;
  /** Add if absent, remove if present. */
  toggle: (media: Media) => void;
}

function pickFromMedia(media: Media): ComfortPick {
  return {
    mediaId: media.id,
    title: displayTitle(media.title),
    coverImage: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    coverColor: media.coverImage?.color ?? null,
    addedAt: Date.now(),
  };
}

/** Every mutation persists through the repository, then reflects in memory. */
export const useComfortStore = create<ComfortState>((set, get) => {
  const persist = (picks: ComfortPick[]) => {
    void comfortRepository.save(picks);
  };

  return {
    picks: [],
    hydrated: false,

    hydrate: async () => {
      const picks = await comfortRepository.getAll();
      set({ picks, hydrated: true });
    },

    add: (media) => {
      if (get().picks.some((p) => p.mediaId === media.id)) return;
      const next = [pickFromMedia(media), ...get().picks]; // newest to the front
      set({ picks: next });
      persist(next);
    },

    remove: (mediaId) => {
      const next = get().picks.filter((p) => p.mediaId !== mediaId);
      set({ picks: next });
      persist(next);
    },

    toggle: (media) => {
      const exists = get().picks.some((p) => p.mediaId === media.id);
      if (exists) get().remove(media.id);
      else get().add(media);
    },
  };
});

/** Whether a given title is on the Comfort shelf. */
export function useIsComfort(mediaId: number): boolean {
  return useComfortStore((s) => s.picks.some((p) => p.mediaId === mediaId));
}
