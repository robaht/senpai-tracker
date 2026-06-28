import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, makeStyles, useTheme } from '../theme';
import { Text } from './ui/Text';
import { withAlpha } from './ui/Badge';
import { PressableScale } from './ui/PressableScale';
import { displayTitle, type AiringScheduleItem, type Media } from '../api/anilist';
import { useIsTracked } from '../features/tracking/store';
import { airingTimeLabel, formatCountdown, humanizeEnum } from '../lib/format';

/**
 * One airing in the weekly schedule: cover, title, episode + countdown.
 * When `onAdd` is supplied (the Upcoming view), a trailing "+" lets the user
 * pick up the title without leaving the schedule; a check shows once tracked.
 */
export function ScheduleRow({
  item,
  onAdd,
}: {
  item: AiringScheduleItem;
  onAdd?: (media: Media) => void;
}) {
  const router = useRouter();
  const { colors, retro } = useTheme();
  const styles = useStyles();
  const tracked = useIsTracked(item.media.id);
  const uri = item.media.coverImage?.large ?? item.media.coverImage?.extraLarge ?? undefined;
  const secondsUntil = item.airingAt - Math.floor(Date.now() / 1000);

  return (
    <PressableScale
      activeScale={0.98}
      style={[styles.row, retro && styles.rowRetro, retro && { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}
      onPress={() => router.push(`/anime/${item.media.id}`)}
    >
      <View
        style={[
          styles.coverWrap,
          retro && styles.coverWrapRetro,
          { backgroundColor: item.media.coverImage?.color ?? colors.surface, borderColor: colors.borderStrong },
        ]}
      >
        <Image source={uri} style={styles.cover} contentFit="cover" transition={200} />
      </View>

      <View style={styles.body}>
        <Text variant="subheading" numberOfLines={1}>
          {displayTitle(item.media.title)}
        </Text>
        <View style={styles.metaRow}>
          {tracked && <View style={[styles.trackedDot, { backgroundColor: colors.accent }]} />}
          <Text variant="caption" color="textFaint">
            {humanizeEnum(item.media.format) || 'Anime'}
          </Text>
        </View>
      </View>

      <View style={styles.right}>
        <Text variant="callout" color={colors.accentSoft}>
          EP {item.episode}
        </Text>
        <Text variant="caption" color="textMuted">
          {airingTimeLabel(item.airingAt)}
        </Text>
        <Text variant="caption" color="textFaint">
          in {formatCountdown(secondsUntil)}
        </Text>
      </View>

      {onAdd && (
        <Pressable
          onPress={() => onAdd(item.media)}
          hitSlop={8}
          style={[styles.add, { backgroundColor: withAlpha(colors.accent, tracked ? 0.1 : 0.18) }]}
          accessibilityRole="button"
          accessibilityLabel={tracked ? 'Already on your list' : 'Add to your list'}
        >
          <Ionicons
            name={tracked ? 'checkmark' : 'add'}
            size={20}
            color={tracked ? colors.accentSoft : colors.accent}
          />
        </Pressable>
      )}
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
  rowRetro: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 3,
  },
  coverWrap: {
    width: 46,
    height: 64,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  coverWrapRetro: {
    borderWidth: 2,
  },
  cover: { width: '100%', height: '100%' },
  body: {
    flex: 1,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  trackedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
  add: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
