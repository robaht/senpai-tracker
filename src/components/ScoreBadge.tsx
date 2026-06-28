import { View, StyleSheet } from 'react-native';
import { makeStyles, useTheme } from '../theme';
import { Text } from './ui/Text';
import { formatScore } from '../lib/format';

/** Small star + score chip shown on posters and detail. Sits over artwork, so it
 *  uses the constant on-media tokens (legible in light themes too). */
export function ScoreBadge({ averageScore }: { averageScore: number | null }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const score = formatScore(averageScore);
  if (!score) return null;
  return (
    <View style={[styles.badge, { backgroundColor: colors.mediaScrim }]}>
      <Text variant="caption" color={colors.onMediaAmber}>
        ★
      </Text>
      <Text variant="caption" color={colors.onMedia}>
        {score}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(({ radii }) => ({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
}));
