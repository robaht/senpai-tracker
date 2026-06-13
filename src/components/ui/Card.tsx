import { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { radii, spacing, useTheme } from '../../theme';

interface CardProps {
  children: ReactNode;
  /** Use the slightly lighter elevated surface. */
  elevated?: boolean;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
}

/** Rounded surface with a hairline border — the base for grouped content. */
export function Card({ children, elevated, padded = true, style }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
          borderColor: colors.border,
        },
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
    overflow: 'hidden',
  },
  padded: {
    padding: spacing.lg,
  },
});
