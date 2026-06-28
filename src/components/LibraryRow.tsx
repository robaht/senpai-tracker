import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, makeStyles, useTheme } from '../theme';
import { Text } from './ui/Text';
import { Badge, withAlpha } from './ui/Badge';
import { PressableScale } from './ui/PressableScale';
import { STATUS_META, statusColor, type TrackEntry } from '../features/tracking/types';
import { useTrackingStore } from '../features/tracking/store';
import { premiereLabel } from '../lib/format';

/** A row in the Library: cover, title, status, progress bar + quick +1 control. */
export function LibraryRow({ entry }: { entry: TrackEntry }) {
  const router = useRouter();
  const { colors, retro } = useTheme();
  const styles = useStyles();
  const increment = useTrackingStore((s) => s.incrementProgress);
  const meta = STATUS_META[entry.status];
  const color = statusColor(colors, entry.status);
  // Not-yet-released titles carry a self-clearing premiere countdown badge.
  const premiere = entry.premiereAt != null ? premiereLabel(entry.premiereAt) : null;

  const total = entry.totalEpisodes;
  const pct = total ? Math.min(1, entry.progress / total) : entry.progress > 0 ? 0.05 : 0;
  const atMax = total != null && entry.progress >= total;

  return (
    <PressableScale
      activeScale={0.98}
      style={[styles.row, retro && styles.rowRetro, retro && { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}
      onPress={() => router.push(`/anime/${entry.mediaId}`)}
    >
      <View
        style={[
          styles.coverWrap,
          retro && styles.coverWrapRetro,
          { backgroundColor: entry.coverColor ?? colors.surface, borderColor: colors.borderStrong },
        ]}
      >
        <Image source={entry.coverImage ?? undefined} style={styles.cover} contentFit="cover" transition={200} />
      </View>

      <View style={styles.body}>
        <Text variant="subheading" numberOfLines={1}>
          {entry.title}
        </Text>
        <View style={styles.metaLine}>
          <Badge label={meta.short} color={color} />
          {premiere && <Badge label={premiere} color={colors.info} />}
          {entry.score > 0 && (
            <Text variant="caption" color={colors.warning}>
              ★ {entry.score}
            </Text>
          )}
        </View>

        <View style={styles.progressRow}>
          <View style={[styles.track, { backgroundColor: colors.surfaceHigh }]}>
            <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
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
          { backgroundColor: withAlpha(color, atMax ? 0.06 : 0.18) },
        ]}
        accessibilityLabel="Increment episode progress"
      >
        <Ionicons
          name={atMax ? 'checkmark' : 'add'}
          size={20}
          color={atMax ? colors.textFaint : color}
        />
      </Pressable>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ radii }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  // Retro: each entry becomes its own cream dialog box.
  rowRetro: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 3,
  },
  coverWrap: {
    width: 52,
    height: 72,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  coverWrapRetro: {
    borderWidth: 2,
  },
  cover: { width: '100%', height: '100%' },
  body: {
    flex: 1,
    gap: 6,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
}));
