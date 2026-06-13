import { View, StyleSheet } from 'react-native';
import { colors, radii } from '../theme';
import { Text } from './ui/Text';
import { formatScore } from '../lib/format';

/** Small star + score chip shown on posters and detail. */
export function ScoreBadge({ averageScore }: { averageScore: number | null }) {
  const score = formatScore(averageScore);
  if (!score) return null;
  return (
    <View style={styles.badge}>
      <Text variant="caption" color={colors.warning}>
        ★
      </Text>
      <Text variant="caption" color={colors.text}>
        {score}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(7,7,12,0.7)',
  },
});
