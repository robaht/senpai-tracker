import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { TypographyVariant, useTheme, type ColorToken } from '../../theme';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  /** A semantic color token, or any raw color string. */
  color?: ColorToken | (string & {});
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  /** Uppercase helper for overlines/labels (we never bake caps into the font). */
  uppercase?: boolean;
}

/**
 * The only text primitive in the app. Always go through this so the type scale
 * and font families stay consistent — never reach for raw <Text> in screens.
 */
export function Text({
  variant = 'body',
  color = 'text',
  align,
  uppercase,
  style,
  children,
  ...rest
}: TextProps) {
  const { colors, typography } = useTheme();
  const resolvedColor = color in colors ? colors[color as ColorToken] : color;
  return (
    <RNText
      style={[
        typography[variant],
        { color: resolvedColor },
        align ? { textAlign: align } : null,
        uppercase ? styles.uppercase : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  uppercase: { textTransform: 'uppercase' },
});
