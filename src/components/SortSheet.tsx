import { Modal, Pressable, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing, useTheme } from '../theme';
import { Text } from './ui/Text';
import { withAlpha } from './ui/Badge';

export type SortKey = 'recent' | 'title' | 'score' | 'progress';

export const SORT_OPTIONS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'recent', label: 'Recently updated', hint: 'Newest changes first' },
  { key: 'title', label: 'Title', hint: 'A → Z' },
  { key: 'score', label: 'Score', hint: 'Highest first' },
  { key: 'progress', label: 'Progress', hint: 'Most episodes watched' },
];

interface SortSheetProps {
  value: SortKey;
  visible: boolean;
  onSelect: (key: SortKey) => void;
  onClose: () => void;
}

/** Bottom-sheet sort picker for the Library. Mirrors AddToListSheet. */
export function SortSheet({ value, visible, onSelect, onClose }: SortSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const choose = (key: SortKey) => {
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
          {SORT_OPTIONS.map(({ key, label, hint }) => {
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
