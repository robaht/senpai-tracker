import { useEffect, useState } from 'react';

/**
 * Returns `value` after it has been stable for `delayMs`. Used to keep
 * search-as-you-type from firing an AniList request per keystroke — the API's
 * effective rate limit (~30 req/min) makes that a fast path to 429s.
 */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
