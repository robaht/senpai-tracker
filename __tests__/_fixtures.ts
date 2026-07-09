import type {
  ExternalLink,
  Media,
  MediaRelationEdge,
  MediaRelationType,
} from '../src/api/anilist/types';
import type { TrackEntry } from '../src/features/tracking/types';
import type { AppNotification, NotificationSnapshot } from '../src/features/notifications/types';

/** Minimal `Media` for tests — only the fields the logic under test reads. */
export function media(id: number, over: Partial<Media> = {}): Media {
  return {
    id,
    idMal: null,
    title: { romaji: `Title ${id}`, english: null, native: null },
    coverImage: { extraLarge: `cover-${id}`, large: null, color: '#abcabc' },
    bannerImage: null,
    format: 'TV',
    status: null,
    description: null,
    episodes: 12,
    duration: 24,
    genres: ['Action'],
    ...over,
  } as Media;
}

export function trackEntry(id: number, over: Partial<TrackEntry> = {}): TrackEntry {
  return {
    mediaId: id,
    status: 'CURRENT',
    progress: 0,
    totalEpisodes: 12,
    score: 0,
    title: `T${id}`,
    coverImage: null,
    coverColor: null,
    format: 'TV',
    duration: 24,
    genres: ['Action'],
    updatedAt: 1000,
    createdAt: 1000,
    ...over,
  };
}

export function relationEdge(
  relationType: MediaRelationType,
  node: Partial<Media> & { id: number },
): MediaRelationEdge {
  return { relationType, node: media(node.id, node) };
}

export function link(site: string, over: Partial<ExternalLink> = {}): ExternalLink {
  return { id: Math.floor(Math.random() * 1e6), url: `https://${site}.test`, site, language: null, ...over } as ExternalLink;
}

export function notification(id: string, over: Partial<AppNotification> = {}): AppNotification {
  return {
    id,
    type: 'new-episode',
    mediaId: 1,
    title: 'Title 1',
    coverImage: null,
    message: 'Episode 1 is out',
    episode: 1,
    episodeCount: 1,
    createdAt: 1000,
    read: false,
    ...over,
  };
}

export function snapshot(mediaId: number, over: Partial<NotificationSnapshot> = {}): NotificationSnapshot {
  return {
    mediaId,
    releasedEpisodes: 0,
    knownSequelIds: [],
    initialized: true,
    lastCheckedAt: 1000,
    ...over,
  };
}
