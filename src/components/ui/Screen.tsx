import { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme';

interface ScreenProps {
  children: ReactNode;
  /** Apply the top safe-area inset as padding. Default true. */
  edgeTop?: boolean;
  /** Apply the bottom safe-area inset as padding. Default false (tab bar handles it). */
  edgeBottom?: boolean;
  style?: ViewStyle;
}

/**
 * Base page container: fills the screen with the app background and applies
 * safe-area insets as padding so content never sits under the notch.
 */
export function Screen({ children, edgeTop = true, edgeBottom = false, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: edgeTop ? insets.top : 0,
          paddingBottom: edgeBottom ? insets.bottom : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
