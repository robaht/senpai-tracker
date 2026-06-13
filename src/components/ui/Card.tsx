import { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../../theme';

interface CardProps {
  children: ReactNode;
  /** Use the slightly lighter elevated surface. */
  elevated?: boolean;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
}

/** Rounded surface with a hairline border — the base for grouped content. */
export function Card({ children, elevated, padded = true, style }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: elevated ? colors.surfaceElevated : colors.surface },
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  padded: {
    padding: spacing.lg,
  },
});
