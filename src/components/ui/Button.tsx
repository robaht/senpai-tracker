import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, spacing } from '../../theme';
import { Text } from './Text';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

/**
 * The app's button. `primary` renders the brand gradient; `secondary` is a solid
 * surface chip; `ghost` is borderless. All share the press-scale feedback.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  fullWidth,
  style,
}: ButtonProps) {
  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onAccent : colors.text} />
      ) : (
        <>
          {icon}
          <Text variant="callout" color={variant === 'primary' ? colors.onAccent : colors.text}>
            {label}
          </Text>
        </>
      )}
    </View>
  );

  const inner =
    variant === 'primary' ? (
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.base, fullWidth && styles.fullWidth]}
      >
        {content}
      </LinearGradient>
    ) : (
      <View
        style={[
          styles.base,
          variant === 'secondary' && styles.secondary,
          variant === 'ghost' && styles.ghost,
          fullWidth && styles.fullWidth,
        ]}
      >
        {content}
      </View>
    );

  return (
    <PressableScale
      onPress={disabled || loading ? undefined : onPress}
      style={[fullWidth ? styles.fullWidth : styles.shrink, disabled && styles.disabled, style]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
    >
      {inner}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  secondary: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  fullWidth: { width: '100%' },
  shrink: { alignSelf: 'flex-start' },
  disabled: { opacity: 0.5 },
});
