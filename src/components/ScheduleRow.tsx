import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { View, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../theme';
import { Text } from './ui/Text';
import { PressableScale } from './ui/PressableScale';
import { displayTitle, type AiringScheduleItem } from '../api/anilist';
import { useIsTracked } from '../features/tracking/store';
import { airingTimeLabel, formatCountdown, humanizeEnum } from '../lib/format';

/** One airing in the weekly schedule: cover, title, episode + countdown. */
export function ScheduleRow({ item }: { item: AiringScheduleItem }) {
  const router = useRouter();
  const tracked = useIsTracked(item.media.id);
  const uri = item.media.coverImage?.large ?? item.media.coverImage?.extraLarge ?? undefined;
  const secondsUntil = item.airingAt - Math.floor(Date.now() / 1000);

  return (
    <PressableScale
      activeScale={0.98}
      style={styles.row}
      onPress={() => router.push(`/anime/${item.media.id}`)}
    >
      <View style={[styles.coverWrap, { backgroundColor: item.media.coverImage?.color ?? colors.surface }]}>
        <Image source={uri} style={styles.cover} contentFit="cover" transition={200} />
      </View>

      <View style={styles.body}>
        <Text variant="subheading" numberOfLines={1}>
          {displayTitle(item.media.title)}
        </Text>
        <View style={styles.metaRow}>
          {tracked && <View style={styles.trackedDot} />}
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
    width: 46,
    height: 64,
    borderRadius: radii.sm,
    overflow: 'hidden',
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
    backgroundColor: colors.accent,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
});
