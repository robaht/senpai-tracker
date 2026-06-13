import { View, StyleSheet } from 'react-native';
import { spacing } from '../theme';
import { Text } from './ui/Text';

interface SectionHeaderProps {
  title: string;
  caption?: string;
}

/** Title + optional caption above a content section. */
export function SectionHeader({ title, caption }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <Text variant="heading">{title}</Text>
        {caption && (
          <Text variant="caption" color="textFaint">
            {caption}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  titles: {
    gap: 2,
  },
});
