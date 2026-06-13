import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View, StyleSheet } from 'react-native';
import { radii, spacing, useTheme } from '../theme';
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

/** Large hero card for the trending carousel — banner art, gradient, title.
 *  All foreground sits over artwork, so it uses the constant on-media tokens. */
export function FeaturedCard({ media, width, rank }: FeaturedCardProps) {
  const router = useRouter();
  const { colors, gradients } = useTheme();
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
      <View
        style={[
          styles.card,
          { backgroundColor: media.coverImage?.color ?? colors.surface, borderColor: colors.border },
        ]}
      >
        <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" transition={260} />
        <LinearGradient colors={gradients.poster} style={StyleSheet.absoluteFill} />

        {rank != null && (
          <View style={styles.rankWrap}>
            <Badge label={`#${rank} trending`} color={colors.accent} variant="solid" />
          </View>
        )}

        <View style={styles.content}>
          <Text variant="title" color={colors.onMedia} numberOfLines={2}>
            {displayTitle(media.title)}
          </Text>
          <View style={styles.meta}>
            {score && (
              <Text variant="callout" color={colors.onMediaAmber}>
                ★ {score}
              </Text>
            )}
            {media.format && (
              <Text variant="callout" color={colors.onMediaMuted}>
                {humanizeEnum(media.format)}
              </Text>
            )}
            {media.episodes != null && (
              <Text variant="callout" color={colors.onMediaMuted}>
                {media.episodes} eps
              </Text>
            )}
          </View>
          <View style={styles.genres}>
            {media.genres.slice(0, 3).map((g) => (
              <Badge key={g} label={g} color={colors.onMedia} />
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
