import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { View, StyleSheet, Pressable } from 'react-native';
import { radii, spacing, useTheme } from '../theme';
import { Text } from './ui/Text';
import { PressableScale } from './ui/PressableScale';
import { withAlpha } from './ui/Badge';
import { displayTitle } from '../api/anilist';
import type { ForYouItem } from '../features/recommendations/hooks';

interface MatchCardProps {
  item: ForYouItem;
  /** Optional "not interested" action — shows a dismiss control when provided. */
  onDismiss?: () => void;
}

/** Tier the match % so a strong fit reads loud and a weak one stays quiet. */
function matchTint(colors: ReturnType<typeof useTheme>['colors'], match: number) {
  if (match >= 75) return colors.accent;
  if (match >= 50) return colors.info;
  return colors.textMuted;
}

/**
 * A taste-match recommendation row: poster + a prominent compatibility %, the
 * "because you watched X" reason, and the genres driving the match. The whole
 * row opens the title; an optional ✕ marks it not interested.
 */
export function MatchCard({ item, onDismiss }: MatchCardProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { media, match, reasons, becauseOf } = item;
  const uri = media.coverImage?.extraLarge ?? media.coverImage?.large ?? undefined;
  const tint = match === null ? colors.textMuted : matchTint(colors, match);

  // The dismiss control is a sibling of the card press target (not nested) so
  // the web build doesn't render a <button> inside a <button>.
  return (
    <View>
      <PressableScale
        style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/anime/${media.id}`)}
        accessibilityRole="button"
        accessibilityLabel={displayTitle(media.title)}
      >
        <Image
          source={uri}
          style={[styles.poster, { backgroundColor: media.coverImage?.color ?? colors.surfaceElevated }]}
          contentFit="cover"
          transition={220}
          recyclingKey={String(media.id)}
        />

        <View style={styles.body}>
          {match !== null && (
            <View style={styles.matchRow}>
              <Text variant="title" color={tint}>
                {match}%
              </Text>
              <Text variant="caption" color="textFaint" uppercase>
                match
              </Text>
            </View>
          )}

          <Text variant="bodyMedium" numberOfLines={2}>
            {displayTitle(media.title)}
          </Text>

          <Text variant="caption" color="textMuted" numberOfLines={1}>
            Because you watched {becauseOf}
          </Text>

          {reasons.length > 0 && (
            <View style={styles.chips}>
              {reasons.map((g) => (
                <View key={g} style={[styles.chip, { backgroundColor: withAlpha(tint, 0.14) }]}>
                  <Text variant="caption" color={tint}>
                    {g}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </PressableScale>

      {onDismiss && (
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          style={styles.dismiss}
          accessibilityRole="button"
          accessibilityLabel={`Not interested in ${displayTitle(media.title)}`}
        >
          <Text variant="callout" color="textFaint">
            ✕
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  poster: {
    width: 72,
    aspectRatio: 2 / 3,
    borderRadius: radii.md,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2,
  },
  chip: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  dismiss: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    padding: spacing.xs,
  },
});
