import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, useTheme } from '../theme';
import { Text } from './ui/Text';

const MAX = 10;

/**
 * Interactive 0–10 star rating for a tracked title. Tapping a star sets the
 * score; tapping the current top star again clears it (0 = unscored). Mirrors
 * AniList's POINT_10 scale, which is what `TrackEntry.score` stores.
 */
export function RatingStars({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text variant="callout" color="textFaint">
          Your rating
        </Text>
        <Text variant="callout" color={value > 0 ? colors.warning : colors.textFaint}>
          {value > 0 ? `${value}/10` : 'Not rated'}
        </Text>
      </View>
      <View style={styles.stars}>
        {Array.from({ length: MAX }).map((_, i) => {
          const n = i + 1;
          const filled = n <= value;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n === value ? 0 : n)}
              hitSlop={6}
              style={styles.star}
              accessibilityRole="button"
              accessibilityState={{ selected: filled }}
              accessibilityLabel={`Rate ${n} out of ${MAX}`}
            >
              <Ionicons
                name={filled ? 'star' : 'star-outline'}
                size={24}
                color={filled ? colors.warning : colors.borderStrong}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  star: { paddingVertical: 2 },
});
