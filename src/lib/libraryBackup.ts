import { WATCH_STATUSES, type TrackEntry, type WatchStatus } from '../features/tracking/types';

/**
 * Local library backup — a lossless XML snapshot of the tracked list.
 *
 * Until accounts + cloud sync (F1) exist, the only copy of a user's list lives
 * in this device's storage. This serializes every `TrackEntry` field (including
 * the display snapshot) so a backup restores the library exactly, offline, with
 * no AniList round-trip — the safety net for "don't lose my list".
 *
 * Symmetric with `restoreEntries` in the tracking store: export here, re-import
 * the same file there. The format is Senpai's own (not MAL's) so it's lossless;
 * MAL import stays a separate path.
 */

export const LIBRARY_BACKUP_VERSION = 1;
export const BACKUP_MIME = 'application/xml';

/** Escape the five chars that matter in XML text content. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Reverse `esc` — `&amp;` last so a literal "&lt;" survives a round-trip. */
function unesc(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Pull one tag's inner text from an `<anime>` block (non-greedy, trimmed). */
function field(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : '';
}

const orNull = (value: string): string | null => (value ? value : null);

/** Serialize the full library to a Senpai backup XML document. */
export function entriesToXml(entries: TrackEntry[]): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<senpai-library version="${LIBRARY_BACKUP_VERSION}" exported="${new Date().toISOString()}" count="${entries.length}">`,
  ];
  for (const e of entries) {
    lines.push(
      '  <anime>',
      `    <mediaId>${e.mediaId}</mediaId>`,
      `    <status>${e.status}</status>`,
      `    <progress>${e.progress}</progress>`,
      `    <totalEpisodes>${e.totalEpisodes ?? ''}</totalEpisodes>`,
      `    <score>${e.score}</score>`,
      `    <title>${esc(e.title)}</title>`,
      `    <coverImage>${esc(e.coverImage ?? '')}</coverImage>`,
      `    <coverColor>${esc(e.coverColor ?? '')}</coverColor>`,
      `    <format>${esc(e.format ?? '')}</format>`,
      `    <duration>${e.duration ?? ''}</duration>`,
      `    <genres>${e.genres.map((g) => `<genre>${esc(g)}</genre>`).join('')}</genres>`,
      `    <updatedAt>${e.updatedAt}</updatedAt>`,
      `    <createdAt>${e.createdAt}</createdAt>`,
      '  </anime>',
    );
  }
  lines.push('</senpai-library>');
  return lines.join('\n');
}

/**
 * Parse a Senpai backup XML document back into `TrackEntry[]`. Blocks missing a
 * usable media id or a recognized status are skipped rather than corrupting the
 * restore; numeric/optional fields fall back to sensible defaults.
 */
export function parseLibraryXml(xml: string): TrackEntry[] {
  const out: TrackEntry[] = [];
  const blocks = xml.match(/<anime>[\s\S]*?<\/anime>/g) ?? [];
  const now = Date.now();

  for (const block of blocks) {
    const mediaId = Number(field(block, 'mediaId'));
    const status = field(block, 'status') as WatchStatus;
    if (!mediaId || !WATCH_STATUSES.includes(status)) continue;

    const totalRaw = field(block, 'totalEpisodes');
    const durationRaw = field(block, 'duration');
    const genres = [...block.matchAll(/<genre>([\s\S]*?)<\/genre>/g)]
      .map((m) => unesc(m[1].trim()))
      .filter(Boolean);
    const updatedAt = Number(field(block, 'updatedAt')) || now;
    const createdAt = Number(field(block, 'createdAt')) || updatedAt;

    out.push({
      mediaId,
      status,
      progress: Math.max(0, Number(field(block, 'progress')) || 0),
      totalEpisodes: totalRaw ? Number(totalRaw) : null,
      score: Math.max(0, Math.min(Number(field(block, 'score')) || 0, 10)),
      title: unesc(field(block, 'title')),
      coverImage: orNull(unesc(field(block, 'coverImage'))),
      coverColor: orNull(unesc(field(block, 'coverColor'))),
      format: orNull(unesc(field(block, 'format'))),
      duration: durationRaw ? Number(durationRaw) : null,
      genres,
      updatedAt,
      createdAt,
    });
  }
  return out;
}

/** `senpai-library-2026-06-19.xml` — dated so backups don't overwrite. */
export function backupFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `senpai-library-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.xml`;
}
