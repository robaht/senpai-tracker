import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { View, FlatList, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, useTheme } from '../theme';
import { Text } from './ui/Text';
import { withAlpha } from './ui/Badge';
import { PressableScale } from './ui/PressableScale';
import { SectionHeader } from './SectionHeader';
import { behindCount, useTrackingStore } from '../features/tracking/store';
import { statusColor, type TrackEntry, type WatchStatus } from '../features/tracking/types';

const CARD_WIDTH = 132;

/** Statuses that count as "in progress" — surfaced for one-tap episode logging. */
const IN_PROGRESS: WatchStatus[] = ['CURRENT', 'REPEATING'];

/**
 * "Continue watching" rail — in-progress titles (CURRENT/REPEATING), most
 * recently updated first, each with a one-tap +1. Pure local data (renders from
 * the TrackEntry snapshot), so it works offline with zero fetches. Renders
 * nothing when there's nothing in progress.
 */
export function ContinueWatchingRail() {
  const entries = useTrackingStore((s) => s.entries);

  const inProgress = useMemo(
    () =>
      Object.values(entries)
        .filter((e) => IN_PROGRESS.includes(e.status))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [entries],
  );

  if (inProgress.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title="Continue watching" caption="Pick up where you left off" />
      <FlatList
        data={inProgress}
        keyExtractor={(item) => String(item.mediaId)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        renderItem={({ item }) => <ContinueCard entry={item} />}
      />
    </View>
  );
}

function ContinueCard({ entry }: { entry: TrackEntry }) {
  const router = useRouter();
  const { colors } = useTheme();
  const increment = useTrackingStore((s) => s.incrementProgress);
  const setStatus = useTrackingStore((s) => s.setStatus);
  const color = statusColor(colors, entry.status);

  const total = entry.totalEpisodes;
  // While airing, the bar fills against episodes actually out — reaching the
  // latest aired episode reads as "caught up", not one-eighth of a season.
  const behind = behindCount(entry);
  const denom = (entry.airingStatus === 'RELEASING' ? entry.airedEpisodes : null) ?? total;
  const pct = denom ? Math.min(1, entry.progress / denom) : entry.progress > 0 ? 0.05 : 0;
  // When the last episode is reached, the +1 turns into a "finish" affordance
  // that marks the title Completed — which drops it from this rail.
  const atMax = total != null && entry.progress >= total;

  return (
    <PressableScale
      activeScale={0.97}
      style={styles.card}
      onPress={() => router.push(`/anime/${entry.mediaId}`)}
      accessibilityRole="button"
      accessibilityLabel={entry.title}
    >
      <View style={[styles.coverWrap, { backgroundColor: entry.coverColor ?? colors.surface, borderColor: colors.border }]}>
        <Image
          source={entry.coverImage ?? undefined}
          style={styles.cover}
          contentFit="cover"
          transition={220}
          recyclingKey={String(entry.mediaId)}
        />

        {behind > 0 && (
          <View style={[styles.newPill, { backgroundColor: colors.mediaScrim }]}>
            <Text variant="overline" color={colors.onMedia}>
              {behind} new
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => (atMax ? setStatus(entry.mediaId, 'COMPLETED') : increment(entry.mediaId))}
          hitSlop={8}
          style={[styles.fab, { backgroundColor: color, borderColor: colors.mediaBorder }]}
          accessibilityLabel={atMax ? 'Mark as completed' : 'Add one episode'}
        >
          <Ionicons name={atMax ? 'checkmark' : 'add'} size={20} color={colors.onMedia} />
        </Pressable>

        <View style={[styles.track, { backgroundColor: withAlpha(colors.onMedia, 0.25) }]}>
          <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>
      </View>

      <Text variant="callout" numberOfLines={1} style={styles.title}>
        {entry.title}
      </Text>
      <Text variant="caption" color="textMuted">
        Ep {entry.progress}
        {total ? ` / ${total}` : ''}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.sm, marginBottom: spacing.lg },
  rail: { gap: spacing.md, paddingRight: spacing.xl },
  card: { width: CARD_WIDTH },
  coverWrap: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  cover: { width: '100%', height: '100%' },
  newPill: {
    position: 'absolute',
    top: spacing.xs + 2,
    left: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  fab: {
    position: 'absolute',
    right: spacing.xs + 2,
    bottom: spacing.sm + 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
  },
  fill: { height: '100%' },
  title: { marginTop: spacing.sm },
});
