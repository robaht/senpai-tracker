/**
 * Helpers for turning AniList's relation graph into something the detail screen
 * can render. AniList has no "season number" field — relations are a graph — so
 * the ordered season list is derived by walking direct PREQUEL/SEQUEL edges.
 *
 * This ships the single-fetch (one-hop) view: immediate neighbors only. A full
 * multi-hop S1→S2→S3 walk is tracked as F7 in BACKLOG.md.
 */
import type { Media, MediaFormat, MediaRelationEdge, MediaRelationType } from '../api/anilist/types';

/** Formats that denote an anime (vs. manga/novel relations we don't surface). */
const ANIME_FORMATS: ReadonlySet<MediaFormat> = new Set<MediaFormat>([
  'TV',
  'TV_SHORT',
  'MOVIE',
  'SPECIAL',
  'OVA',
  'ONA',
  'MUSIC',
]);

/**
 * Display order for the "Related" rail — story-continuation relations first,
 * meta/source relations last. Types missing here sort to the end.
 */
const RELATION_PRIORITY: Record<MediaRelationType, number> = {
  PREQUEL: 0,
  SEQUEL: 1,
  PARENT: 2,
  SIDE_STORY: 3,
  SPIN_OFF: 4,
  ALTERNATIVE: 5,
  SUMMARY: 6,
  ADAPTATION: 7,
  CHARACTER: 8,
  SOURCE: 9,
  COMPILATION: 10,
  CONTAINS: 11,
  OTHER: 12,
};

/** True for anime relations. Keeps null-format nodes (e.g. unannounced sequels). */
function isAnimeRelation(edge: MediaRelationEdge): boolean {
  const { format } = edge.node;
  return format == null || ANIME_FORMATS.has(format);
}

/**
 * Anime relations ordered for display: story relations first, then by recency.
 * Filters out manga/novel/etc. relations.
 */
export function sortRelations(edges: MediaRelationEdge[] = []): MediaRelationEdge[] {
  return edges
    .filter(isAnimeRelation)
    .slice()
    .sort((a, b) => {
      const byType = RELATION_PRIORITY[a.relationType] - RELATION_PRIORITY[b.relationType];
      if (byType !== 0) return byType;
      // Within a relation type, newest first (unknown years sort last).
      return (b.node.seasonYear ?? -Infinity) - (a.node.seasonYear ?? -Infinity);
    });
}

/**
 * Ordered local season chain `[prequel?, current, sequel?]` from direct edges.
 * Returns `[]` when neither a prequel nor a sequel exists (nothing to order).
 * When a relation type has several candidates (a branch), prefers the entry
 * matching the current title's format — i.e. the TV continuation over a recap.
 */
export function buildSeasonChain(current: Media, edges: MediaRelationEdge[] = []): Media[] {
  const pick = (type: MediaRelationType): Media | null => {
    const matches = edges.filter((e) => e.relationType === type && isAnimeRelation(e));
    const sameFormat = matches.find((e) => e.node.format === current.format);
    return (sameFormat ?? matches[0])?.node ?? null;
  };

  const prequel = pick('PREQUEL');
  const sequel = pick('SEQUEL');
  if (!prequel && !sequel) return [];

  return [prequel, current, sequel].filter((m): m is Media => m != null);
}
