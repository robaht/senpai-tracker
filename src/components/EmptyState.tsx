import { View, StyleSheet, Pressable } from 'react-native';
import { radii, spacing, useTheme } from '../theme';
import { withAlpha } from './ui/Badge';
import { Text } from './ui/Text';

interface EmptyStateProps {
  emoji?: string;
  title: string;
  subtitle?: string;
  /** Optional action button (e.g. "Try again" on load failures). */
  actionLabel?: string;
  onAction?: () => void;
}

/** Friendly centered placeholder for empty lists / no results. */
export function EmptyState({ emoji = '✶', title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text variant="subheading" align="center">
        {title}
      </Text>
      {subtitle && (
        <Text variant="body" color="textFaint" align="center" style={styles.subtitle}>
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={[
            styles.action,
            { backgroundColor: withAlpha(colors.accent, 0.16), borderColor: colors.accent },
          ]}
        >
          <Text variant="callout" color={colors.accent}>
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing['2xl'],
    gap: spacing.sm,
  },
  emoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  subtitle: {
    maxWidth: 280,
  },
  action: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
