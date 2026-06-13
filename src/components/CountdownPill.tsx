import { View, StyleSheet } from 'react-native';
import { radii, spacing, useTheme } from '../theme';
import { Text } from './ui/Text';
import { withAlpha } from './ui/Badge';
import { formatCountdown } from '../lib/format';
import type { AiringSchedule } from '../api/anilist';

/** "EP 7 in 2d 4h" pill driven by AniList's nextAiringEpisode. */
export function CountdownPill({
  next,
  compact,
}: {
  next: AiringSchedule;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const countdown = formatCountdown(next.timeUntilAiring);
  return (
    <View style={[styles.pill, { backgroundColor: withAlpha(colors.accent, 0.16) }]}>
      <View style={[styles.dot, { backgroundColor: colors.accent }]} />
      <Text variant="caption" color={colors.accentSoft}>
        {compact ? `EP ${next.episode}` : `EP ${next.episode} · `}
        {!compact && <Text variant="caption" color={colors.text}>{`in ${countdown}`}</Text>}
        {compact && ` · ${countdown}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
