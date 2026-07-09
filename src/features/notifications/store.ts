import { create } from 'zustand';
import { notificationRepository } from './repository';
import type { AppNotification } from './types';

interface NotificationState {
  entries: Record<string, AppNotification>; // keyed by id
  hydrated: boolean;

  /** Load persisted entries into memory. Call once at app start. */
  hydrate: () => Promise<void>;

  /** Add a notification (no-ops if its id already exists — see types.ts). */
  add: (n: AppNotification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

/**
 * Mirrors `useTrackingStore`'s shape. Every mutation persists through the
 * repository, then reflects in memory — fire-and-forget, same as
 * `useTrackingStore`'s `persist`/`update` helpers.
 */
export const useNotificationStore = create<NotificationState>((set, get) => {
  const persist = (n: AppNotification) => {
    void notificationRepository.upsert(n);
  };

  return {
    entries: {},
    hydrated: false,

    hydrate: async () => {
      const all = await notificationRepository.getAll();
      const map: Record<string, AppNotification> = {};
      for (const n of all) map[n.id] = n;
      set({ entries: map, hydrated: true });
    },

    add: (n) => {
      // The dedupe id can never legitimately collide with a different event
      // (see types.ts), so an existing id means this exact notification was
      // already recorded — no-op rather than trusting the caller.
      if (get().entries[n.id]) return;
      set((s) => ({ entries: { ...s.entries, [n.id]: n } }));
      persist(n);
    },

    markRead: (id) => {
      const existing = get().entries[id];
      if (!existing || existing.read) return;
      const next: AppNotification = { ...existing, read: true };
      set((s) => ({ entries: { ...s.entries, [id]: next } }));
      persist(next);
    },

    markAllRead: () => {
      const current = get().entries;
      const unread = Object.values(current).filter((n) => !n.read);
      if (unread.length === 0) return;
      const next: Record<string, AppNotification> = { ...current };
      for (const n of unread) next[n.id] = { ...n, read: true };
      set({ entries: next });
      void notificationRepository.replaceAll(Object.values(next));
    },
  };
});

/** Selector hook: count of unread notifications. */
export function useUnreadCount(): number {
  return useNotificationStore((s) => {
    let count = 0;
    for (const n of Object.values(s.entries)) if (!n.read) count += 1;
    return count;
  });
}
