import { View, StyleSheet } from 'react-native';
import { spacing } from '../theme';
import { Text } from './ui/Text';

interface EmptyStateProps {
  emoji?: string;
  title: string;
  subtitle?: string;
}

/** Friendly centered placeholder for empty lists / no results. */
export function EmptyState({ emoji = '✶', title, subtitle }: EmptyStateProps) {
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
});
