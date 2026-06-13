import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { colors, radii, spacing, fonts } from '../theme';
import { Text } from './ui/Text';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

/** Rounded search field with a leading glyph and clear button. */
export function SearchBar({ value, onChangeText, placeholder = 'Search anime…' }: SearchBarProps) {
  return (
    <View style={styles.wrap}>
      <Text variant="subheading" color="textFaint" style={styles.icon}>
        ⌕
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={styles.input}
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
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: spacing.sm,
  },
  icon: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 15,
    height: '100%',
  },
  clear: {
    padding: 4,
  },
});
