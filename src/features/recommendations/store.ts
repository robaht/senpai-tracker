import { create } from 'zustand';
import { dismissedRepository } from './repository';

interface DismissedState {
  /** AniList media ids the user marked "not interested". */
  ids: Set<number>;
  hydrated: boolean;

  /** Load persisted dismissals into memory. Call once at app start. */
  hydrate: () => Promise<void>;

  dismiss: (mediaId: number) => void;
  /** Bring a title back into recommendations (undo). */
  restore: (mediaId: number) => void;
  /** Forget every dismissal — recommendations start fresh. */
  clear: () => void;
}

/** Every mutation persists through the repository, then reflects in memory. */
export const useDismissedStore = create<DismissedState>((set, get) => {
  const persist = (ids: Set<number>) => {
    void dismissedRepository.save([...ids]);
  };

  return {
    ids: new Set(),
    hydrated: false,

    hydrate: async () => {
      const ids = await dismissedRepository.getAll();
      set({ ids: new Set(ids), hydrated: true });
    },

    dismiss: (mediaId) => {
      const next = new Set(get().ids);
      next.add(mediaId);
      set({ ids: next });
      persist(next);
    },

    restore: (mediaId) => {
      const next = new Set(get().ids);
      next.delete(mediaId);
      set({ ids: next });
      persist(next);
    },

    clear: () => {
      const next = new Set<number>();
      set({ ids: next });
      persist(next);
    },
  };
});
