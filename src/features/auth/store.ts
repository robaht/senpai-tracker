import { create } from 'zustand';
import { getViewer, setAuthToken, type Viewer } from '../../api/anilist';
import { useTrackingStore } from '../tracking/store';
import { consumeRedirectToken } from './anilistAuth';
import { clearToken, getToken, setToken } from './tokenStore';

/**
 * AniList auth session (F1, Phase 1). Holds the bearer token + the signed-in
 * user. The OAuth browser flow lives in `useAniListSignIn` (a hook); on success
 * it calls `completeSignIn(token)`. This store owns persistence, header wiring,
 * and the viewer fetch — and is where Phase 2 will trigger list sync.
 */
type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  token: string | null;
  viewer: Viewer | null;
  status: AuthStatus;

  /** Load a persisted token, wire the client header, fetch the viewer. */
  hydrate: () => Promise<void>;
  /** Finish OAuth: persist the token, wire it, resolve the viewer. */
  completeSignIn: (token: string) => Promise<void>;
  /** Clear the session (token + header + viewer). */
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  /** Apply a token everywhere and resolve the viewer; clears on failure. */
  const applyToken = async (token: string): Promise<boolean> => {
    setAuthToken(token);
    try {
      const viewer = await getViewer();
      if (!viewer) throw new Error('no viewer');
      set({ token, viewer, status: 'signedIn' });
      return true;
    } catch {
      setAuthToken(null);
      set({ token: null, viewer: null, status: 'signedOut' });
      return false;
    }
  };

  return {
    token: null,
    viewer: null,
    status: 'loading',

    hydrate: async () => {
      // Web: if we just came back from AniList via a full-page redirect, the
      // token is in the URL fragment — consume it (mobile web can't keep the
      // in-memory sign-in promise across the redirect).
      const redirectToken = consumeRedirectToken();
      if (redirectToken) {
        await get().completeSignIn(redirectToken);
        return;
      }
      const token = await getToken();
      if (!token) {
        set({ status: 'signedOut' });
        return;
      }
      const ok = await applyToken(token);
      if (!ok) await clearToken(); // stale/expired token — drop it
    },

    completeSignIn: async (token) => {
      await setToken(token);
      const ok = await applyToken(token);
      if (!ok) await clearToken();
    },

    signOut: async () => {
      await clearToken();
      setAuthToken(null);
      set({ token: null, viewer: null, status: 'signedOut' });
      // Drop the synced list from memory but keep the local cache (per F1 AC).
      useTrackingStore.getState().clearInMemory();
    },
  };
});
