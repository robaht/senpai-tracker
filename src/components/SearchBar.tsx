import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { radii, spacing, fonts, useTheme } from '../theme';
import { Text } from './ui/Text';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

/** Rounded search field with a leading glyph and clear button. */
export function SearchBar({ value, onChangeText, placeholder = 'Search anime…' }: SearchBarProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="subheading" color="textFaint" style={styles.icon}>
        ⌕
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={[styles.input, { color: colors.text }]}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} style={styles.clear}>
          <Text variant="caption" color="textMuted">
            ✕
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: spacing.sm,
  },
  icon: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    height: '100%',
  },
  clear: {
    padding: 4,
  },
});
