import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/**
 * Plays the top anime's **opening theme** under the Wrapped story — actual OP
 * music (no dialogue/voice lines, unlike a trailer), sourced from the community
 * AnimeThemes.moe API + CDN.
 *
 * AnimeThemes serves OP/ED themes as direct `.ogg` files, so we resolve the top
 * show's OP by title (their search maps English↔romaji, e.g. "Attack on Titan"
 * → "Shingeki no Kyojin") and play it through `expo-audio`.
 *
 * **Codec gate:** Ogg Vorbis only decodes on Chrome/Firefox/Edge and Android —
 * **Apple platforms (iOS + Safari) can't play it**. So we feature-detect Ogg
 * support and report `available: false` where it won't work, which hides the
 * sound control entirely (no misleading "now playing" with no audio). On
 * supported platforms, autoplay rides the tap that opened Wrapped; if a browser
 * blocks it, toggling sound (a fresh gesture) starts it.
 */

/** Whether this platform/browser can actually decode the .ogg theme files. */
function canPlayOgg(): boolean {
  if (Platform.OS === 'ios') return false; // AVFoundation has no Ogg Vorbis
  if (Platform.OS === 'android') return true;
  if (typeof document === 'undefined') return false;
  try {
    return document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"') !== '';
  } catch {
    return false;
  }
}

const OGG_SUPPORTED = canPlayOgg();

export interface OpeningTheme {
  songTitle: string | null;
  audioUrl: string;
}

interface UseOpeningTheme {
  enabled: boolean;
  toggle: () => void;
  /** True once a playable OP has been resolved (web only). */
  available: boolean;
  /** "THE WORLD" — for a now-playing label. */
  nowPlaying: string | null;
}

const API = 'https://api.animethemes.moe';
const cache = new Map<string, OpeningTheme | null>();

/** Resolve a title to its first OP theme with playable audio, or null. */
export async function fetchOpeningTheme(title: string): Promise<OpeningTheme | null> {
  const key = title.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;

  const params = new URLSearchParams({
    q: title,
    'fields[search]': 'anime',
    'include[anime]': 'animethemes.song,animethemes.animethemeentries.videos.audio',
  });
  let result: OpeningTheme | null = null;
  try {
    const res = await fetch(`${API}/search?${params.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as SearchResponse;
      result = pickOpening(data);
    }
  } catch {
    result = null;
  }
  cache.set(key, result);
  return result;
}

/** Walk search results → first anime with an OP theme that has audio. */
function pickOpening(data: SearchResponse): OpeningTheme | null {
  for (const anime of data.search?.anime ?? []) {
    // Prefer the earliest OP (OP1 before OP2…).
    const ops = (anime.animethemes ?? [])
      .filter((t) => t.type === 'OP')
      .sort((a, b) => (a.sequence ?? 99) - (b.sequence ?? 99));
    for (const theme of ops) {
      for (const entry of theme.animethemeentries ?? []) {
        for (const video of entry.videos ?? []) {
          const link = video.audio?.link;
          if (link) return { songTitle: theme.song?.title ?? null, audioUrl: link };
        }
      }
    }
  }
  return null;
}

export function useOpeningTheme(title: string | null | undefined, initiallyEnabled = true): UseOpeningTheme {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [theme, setTheme] = useState<OpeningTheme | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Resolve the OP for the current title (only where the .ogg can actually play).
  useEffect(() => {
    if (!OGG_SUPPORTED || !title) return;
    let active = true;
    void fetchOpeningTheme(title).then((t) => {
      if (active) setTheme(t);
    });
    return () => {
      active = false;
    };
  }, [title]);

  // Build / tear down the player when the resolved track changes.
  useEffect(() => {
    if (!OGG_SUPPORTED || !theme) return;
    const player = createAudioPlayer({ uri: theme.audioUrl });
    player.loop = true;
    player.volume = 0.5;
    playerRef.current = player;
    try {
      if (enabledRef.current) player.play();
    } catch {
      /* autoplay blocked; toggle will start it */
    }
    return () => {
      try {
        player.remove();
      } catch {
        /* already released */
      }
      playerRef.current = null;
    };
  }, [theme]);

  // React to the on/off toggle.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (enabled) player.play();
      else player.pause();
    } catch {
      /* not ready yet */
    }
  }, [enabled, theme]);

  const toggle = useCallback(() => setEnabled((e) => !e), []);
  return { enabled, toggle, available: OGG_SUPPORTED && !!theme, nowPlaying: theme?.songTitle ?? null };
}

// --- AnimeThemes response shapes (only the fields we read) ---

interface SearchResponse {
  search?: { anime?: AnimeThemesAnime[] };
}
interface AnimeThemesAnime {
  name: string;
  animethemes?: AnimeTheme[];
}
interface AnimeTheme {
  type: string;
  sequence: number | null;
  song?: { title?: string } | null;
  animethemeentries?: { videos?: { audio?: { link?: string } | null }[] }[];
}
