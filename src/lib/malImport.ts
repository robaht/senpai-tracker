import { gunzipSync, strFromU8 } from 'fflate';
import { getMediaByMalIds, type ImportedListEntry } from '../api/anilist';
import type { WatchStatus } from '../features/tracking/types';

/**
 * MyAnimeList list import (XML export path).
 *
 * MAL has no export from its mobile app; users grab the gzipped XML from the
 * website (Profile → Settings → Import/Export → Export, a `.xml.gz` download).
 * This module turns that file into the same `ImportedListEntry[]` shape the
 * AniList username import produces, so it reuses the shipped
 * `useTrackingStore.importFromList` merge/replace plumbing verbatim.
 *
 * Two hops: (1) parse the XML locally into MAL-keyed rows, (2) resolve those MAL
 * ids to AniList `Media` via `idMal_in` so detail/relations/airing work after.
 */

/** One parsed row from the MAL export, before AniList resolution. */
export interface MalEntry {
  /** `series_animedb_id` — the MyAnimeList media id. */
  malId: number;
  title: string;
  status: WatchStatus;
  /** `my_watched_episodes`. */
  progress: number;
  /** `my_score`, already 0–10 (same scale as TrackEntry.score). */
  score: number;
}

/** MAL ids resolve in pages of 50 (AniList's `Page` max). */
const CHUNK = 50;

/** MAL's `my_status` strings → our WatchStatus (mirrors AniList's enum). */
const STATUS_MAP: Record<string, WatchStatus> = {
  Watching: 'CURRENT',
  Completed: 'COMPLETED',
  'On-Hold': 'PAUSED',
  Dropped: 'DROPPED',
  'Plan to Watch': 'PLANNING',
};

/** Pull one tag's inner text from an `<anime>` block, unwrapping CDATA. */
function field(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!m) return '';
  return m[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

/**
 * Parse a MAL export (raw bytes — gzipped `.xml.gz` or an already-extracted
 * `.xml`) into MAL-keyed rows. Gzip is detected by magic bytes, so both the
 * downloaded file and a manually unzipped one work. Rows without a usable MAL id
 * or a recognized status are dropped (e.g. the manga export, blank rows).
 */
export function parseMalXml(bytes: Uint8Array): MalEntry[] {
  const isGzip = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  const xml = strFromU8(isGzip ? gunzipSync(bytes) : bytes);

  const out: MalEntry[] = [];
  const blocks = xml.match(/<anime>[\s\S]*?<\/anime>/g) ?? [];
  for (const block of blocks) {
    const malId = Number(field(block, 'series_animedb_id'));
    const status = STATUS_MAP[field(block, 'my_status')];
    if (!malId || !status) continue;
    out.push({
      malId,
      title: field(block, 'series_title'),
      status,
      progress: Number(field(block, 'my_watched_episodes')) || 0,
      score: Math.max(0, Math.min(Number(field(block, 'my_score')) || 0, 10)),
    });
  }
  return out;
}

/** Progress of the resolution phase, for the UI's progress bar. */
export interface ResolveProgress {
  resolved: number;
  total: number;
}

export interface ResolveResult {
  /** Successfully resolved entries, ready for `importFromList`. */
  list: ImportedListEntry[];
  /** Rows MAL had but AniList couldn't resolve (reported, not silently dropped). */
  unresolved: MalEntry[];
}

/**
 * Resolve parsed MAL rows to AniList `Media`, chunked at 50 ids/request to stay
 * under AniList's ~90 req/min limit. `updatedAt` is stamped at import time
 * (MAL's XML carries no reliable per-entry timestamp) — last-write-wins in the
 * merge then treats the import as the freshest copy, the same fallback the
 * AniList username import uses.
 */
export async function resolveMalEntries(
  entries: MalEntry[],
  onProgress?: (p: ResolveProgress) => void,
): Promise<ResolveResult> {
  const now = Date.now();
  // Dedupe by MAL id (a clean export shouldn't repeat, but be defensive).
  const byMalId = new Map<number, MalEntry>();
  for (const e of entries) byMalId.set(e.malId, e);
  const unique = [...byMalId.values()];

  const list: ImportedListEntry[] = [];
  const resolvedMalIds = new Set<number>();

  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const media = await getMediaByMalIds(chunk.map((e) => e.malId));
    for (const m of media) {
      const row = m.idMal != null ? byMalId.get(m.idMal) : undefined;
      if (!row) continue;
      resolvedMalIds.add(row.malId);
      list.push({
        media: m,
        status: row.status,
        progress: row.progress,
        score: row.score,
        updatedAt: now,
      });
    }
    onProgress?.({ resolved: Math.min(i + CHUNK, unique.length), total: unique.length });
  }

  const unresolved = unique.filter((e) => !resolvedMalIds.has(e.malId));
  return { list, unresolved };
}
