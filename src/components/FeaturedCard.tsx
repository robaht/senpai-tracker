import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View, StyleSheet } from 'react-native';
import { colors, gradients, radii, spacing } from '../theme';
import { Text } from './ui/Text';
import { Badge } from './ui/Badge';
import { PressableScale } from './ui/PressableScale';
import { displayTitle, type Media } from '../api/anilist';
import { formatScore, humanizeEnum } from '../lib/format';

interface FeaturedCardProps {
  media: Media;
  width: number;
  rank?: number;
}

/** Large hero card for the trending carousel — banner art, gradient, title. */
export function FeaturedCard({ media, width, rank }: FeaturedCardProps) {
  const router = useRouter();
  const uri =
    media.bannerImage ?? media.coverImage?.extraLarge ?? media.coverImage?.large ?? undefined;
  const score = formatScore(media.averageScore);

  return (
    <PressableScale
      style={{ width }}
      activeScale={0.98}
      onPress={() => router.push(`/anime/${media.id}`)}
      accessibilityRole="button"
      accessibilityLabel={displayTitle(media.title)}
    >
      <View style={[styles.card, { backgroundColor: media.coverImage?.color ?? colors.surface }]}>
        <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" transition={260} />
        <LinearGradient colors={gradients.poster} style={StyleSheet.absoluteFill} />

        {rank != null && (
          <View style={styles.rankWrap}>
            <Badge label={`#${rank} trending`} color={colors.accent} variant="solid" />
          </View>
        )}

        <View style={styles.content}>
          <Text variant="title" numberOfLines={2}>
            {displayTitle(media.title)}
          </Text>
          <View style={styles.meta}>
            {score && (
              <Text variant="callout" color={colors.warning}>
                ★ {score}
              </Text>
            )}
            {media.format && (
              <Text variant="callout" color={colors.textMuted}>
                {humanizeEnum(media.format)}
              </Text>
            )}
            {media.episodes != null && (
              <Text variant="callout" color={colors.textMuted}>
                {media.episodes} eps
              </Text>
            )}
          </View>
          <View style={styles.genres}>
            {media.genres.slice(0, 3).map((g) => (
              <Badge key={g} label={g} color={colors.accentSoft} />
            ))}
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    justifyContent: 'flex-end',
  },
  rankWrap: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  genres: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    marginTop: 2,
  },
});
