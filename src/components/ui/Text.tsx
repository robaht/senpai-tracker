import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { colors, typography, TypographyVariant } from '../../theme';

type ColorToken = keyof typeof colors;

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
  const resolvedColor = (colors as Record<string, string>)[color] ?? color;
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
