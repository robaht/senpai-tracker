import { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { spacing, makeStyles, useTheme } from '../../theme';

interface CardProps {
  children: ReactNode;
  /** Use the slightly lighter elevated surface. */
  elevated?: boolean;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
}

/** Rounded surface with a hairline border — the base for grouped content.
 *  In the retro theme it becomes a square dialog box with a thick navy border. */
export function Card({ children, elevated, padded = true, style }: CardProps) {
  const { colors, retro } = useTheme();
  const styles = useStyles();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
          borderColor: retro ? colors.borderStrong : colors.border,
        },
        retro && styles.retro,
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const useStyles = makeStyles(({ radii }) => ({
  card: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  retro: {
    borderWidth: 3,
  },
  padded: {
    padding: spacing.lg,
  },
}));
