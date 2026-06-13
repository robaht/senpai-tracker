import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { View, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../theme';
import { Text } from './ui/Text';
import { PressableScale } from './ui/PressableScale';
import { ScoreBadge } from './ScoreBadge';
import { displayTitle, type Media } from '../api/anilist';
import { STATUS_META } from '../features/tracking/types';
import { useTrackEntry } from '../features/tracking/store';

interface PosterCardProps {
  media: Media;
  /** Fixed width — caller controls grid vs. rail sizing. */
  width: number;
  /** Hide the title row (e.g. dense rails). */
  hideTitle?: boolean;
}

/** Poster tile: cover art + score + tracked indicator + title. The core list unit. */
export function PosterCard({ media, width, hideTitle }: PosterCardProps) {
  const router = useRouter();
  const entry = useTrackEntry(media.id);
  const uri = media.coverImage?.extraLarge ?? media.coverImage?.large ?? undefined;

  return (
    <PressableScale
      style={{ width }}
      onPress={() => router.push(`/anime/${media.id}`)}
      accessibilityRole="button"
      accessibilityLabel={displayTitle(media.title)}
    >
      <View style={[styles.posterWrap, { backgroundColor: media.coverImage?.color ?? colors.surface }]}>
        <Image
          source={uri}
          style={styles.poster}
          contentFit="cover"
          transition={220}
          recyclingKey={String(media.id)}
        />
        <View style={styles.scoreSlot}>
          <ScoreBadge averageScore={media.averageScore} />
        </View>
        {entry && (
          <View style={[styles.statusDot, { backgroundColor: STATUS_META[entry.status].color }]} />
        )}
      </View>
      {!hideTitle && (
        <Text variant="callout" numberOfLines={2} style={styles.title}>
          {displayTitle(media.title)}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  posterWrap: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  scoreSlot: {
    position: 'absolute',
    left: spacing.xs + 2,
    bottom: spacing.xs + 2,
  },
  statusDot: {
    position: 'absolute',
    top: spacing.xs + 2,
    right: spacing.xs + 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(7,7,12,0.55)',
  },
  title: {
    marginTop: spacing.sm,
  },
});
