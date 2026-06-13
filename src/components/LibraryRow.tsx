import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../theme';
import { Text } from './ui/Text';
import { Badge, withAlpha } from './ui/Badge';
import { PressableScale } from './ui/PressableScale';
import { STATUS_META, type TrackEntry } from '../features/tracking/types';
import { useTrackingStore } from '../features/tracking/store';

/** A row in the Library: cover, title, status, progress bar + quick +1 control. */
export function LibraryRow({ entry }: { entry: TrackEntry }) {
  const router = useRouter();
  const increment = useTrackingStore((s) => s.incrementProgress);
  const meta = STATUS_META[entry.status];

  const total = entry.totalEpisodes;
  const pct = total ? Math.min(1, entry.progress / total) : entry.progress > 0 ? 0.05 : 0;
  const atMax = total != null && entry.progress >= total;

  return (
    <PressableScale
      activeScale={0.98}
      style={styles.row}
      onPress={() => router.push(`/anime/${entry.mediaId}`)}
    >
      <View style={[styles.coverWrap, { backgroundColor: entry.coverColor ?? colors.surface }]}>
        <Image source={entry.coverImage ?? undefined} style={styles.cover} contentFit="cover" transition={200} />
      </View>

      <View style={styles.body}>
        <Text variant="subheading" numberOfLines={1}>
          {entry.title}
        </Text>
        <Badge label={meta.short} color={meta.color} />

        <View style={styles.progressRow}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: meta.color }]} />
          </View>
          <Text variant="caption" color="textMuted">
            {entry.progress}
            {total ? ` / ${total}` : ''}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => increment(entry.mediaId)}
        disabled={atMax}
        hitSlop={8}
        style={[
          styles.plus,
          { backgroundColor: withAlpha(meta.color, atMax ? 0.06 : 0.18) },
        ]}
        accessibilityLabel="Increment episode progress"
      >
        <Ionicons
          name={atMax ? 'checkmark' : 'add'}
          size={20}
          color={atMax ? colors.textFaint : meta.color}
        />
      </Pressable>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  coverWrap: {
    width: 52,
    height: 72,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  cover: { width: '100%', height: '100%' },
  body: {
    flex: 1,
    gap: 6,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  track: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surfaceHigh,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  plus: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
