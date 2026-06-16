import { ReactNode } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * One QueryClient for the whole app. Defaults are tuned for AniList:
 * - long staleTime so we don't refetch catalog data the user just saw
 *   (also keeps us well under the 90 req/min rate limit), and
 * - cached results are persisted to AsyncStorage, so the app opens with content
 *   instantly and works offline for anything previously viewed.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min
      gcTime: 1000 * 60 * 60 * 24, // keep in cache 24h for persistence
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'senpai-query-cache',
});

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      // `buster` discards the persisted cache when its shape changes. Bumped when
      // the seasonal/search/airing queries moved from single-page (`useQuery`,
      // `Page<T>`) to paged (`useInfiniteQuery`, `InfiniteData`): hydrating the old
      // shape into an infinite query crashes on `data.pages`. Bump on shape changes.
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24, buster: 'v2-infinite' }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
