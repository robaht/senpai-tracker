import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * Back navigation that never dead-ends.
 *
 * When there's in-app history we pop it; when there isn't — a deep link, a cold
 * start, or a web bfcache/resume that dropped the in-memory navigation stack —
 * we fall back to home instead of `router.back()` silently no-opping (F23). Every
 * back affordance routes through this so a stale session can't strand the user.
 */
export function useGoBack() {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
}
