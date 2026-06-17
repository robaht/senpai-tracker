import { Modal, Pressable, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing, useTheme } from '../theme';
import type { MediaSort } from '../api/anilist';
import { Text } from './ui/Text';
import { withAlpha } from './ui/Badge';

export const BROWSE_SORT_OPTIONS: { key: MediaSort; label: string; hint: string }[] = [
  { key: 'POPULARITY_DESC', label: 'Popularity', hint: 'Most popular first' },
  { key: 'SCORE_DESC', label: 'Score', hint: 'Highest rated first' },
  { key: 'TRENDING_DESC', label: 'Trending', hint: 'Hot right now' },
];

interface BrowseSortSheetProps {
  value: MediaSort;
  visible: boolean;
  onSelect: (key: MediaSort) => void;
  onClose: () => void;
}

/** Bottom-sheet sort picker for the Browse screen. Mirrors SortSheet. */
export function BrowseSortSheet({ value, visible, onSelect, onClose }: BrowseSortSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const choose = (key: MediaSort) => {
    onSelect(key);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.borderStrong,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
        <Text variant="caption" color="textFaint" uppercase>
          Sort by
        </Text>

        <View style={styles.options}>
          {BROWSE_SORT_OPTIONS.map(({ key, label, hint }) => {
            const active = value === key;
            return (
              <Pressable
                key={key}
                onPress={() => choose(key)}
                style={[
                  styles.option,
                  { borderColor: active ? colors.accent : colors.border },
                  active && { backgroundColor: withAlpha(colors.accent, 0.14) },
                ]}
              >
                <View style={styles.optionText}>
                  <Text variant="bodyMedium" color={active ? colors.text : colors.textMuted}>
                    {label}
                  </Text>
                  <Text variant="caption" color="textFaint">
                    {hint}
                  </Text>
                </View>
                {active && (
                  <Text variant="callout" color={colors.accent} style={styles.check}>
                    ✓
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.lg,
  },
  options: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  optionText: {
    gap: 2,
  },
  check: {
    marginLeft: 'auto',
  },
});
