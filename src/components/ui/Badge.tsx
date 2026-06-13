import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../../theme';
import { Text } from './Text';

interface BadgeProps {
  label: string;
  /** Accent color for the badge — defaults to a neutral surface chip. */
  color?: string;
  /** Solid filled vs. tinted (translucent) treatment. */
  variant?: 'tinted' | 'solid' | 'outline';
  icon?: React.ReactNode;
  style?: ViewStyle;
}

/** Compact pill label — used for genres, formats, scores, statuses. */
export function Badge({ label, color = colors.textMuted, variant = 'tinted', icon, style }: BadgeProps) {
  const isSolid = variant === 'solid';
  const isOutline = variant === 'outline';
  return (
    <View
      style={[
        styles.badge,
        isSolid && { backgroundColor: color },
        !isSolid && !isOutline && { backgroundColor: withAlpha(color, 0.16) },
        isOutline && { borderWidth: 1, borderColor: withAlpha(color, 0.4) },
        style,
      ]}
    >
      {icon}
      <Text
        variant="overline"
        color={isSolid ? colors.onAccent : color}
        style={icon ? styles.labelWithIcon : undefined}
      >
        {label}
      </Text>
    </View>
  );
}

/** Adds an alpha channel to a #RRGGBB hex; passes through rgba()/named colors. */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#') && color.length === 7) {
    const a = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0');
    return `${color}${a}`;
  }
  return color;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.pill,
    gap: 4,
  },
  labelWithIcon: {
    marginLeft: 2,
  },
});
