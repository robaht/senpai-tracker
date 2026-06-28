import { View, StyleSheet, ViewStyle } from 'react-native';
import { spacing, makeStyles, useTheme } from '../../theme';
import { Text } from './Text';

interface BadgeProps {
  label: string;
  /** Accent color for the badge — defaults to a neutral surface chip. */
  color?: string;
  /**
   * - `tinted`  — translucent fill of `color` (default).
   * - `solid`   — opaque `color` fill with `onAccent` text.
   * - `outline` — hairline ring of `color`.
   * - `onMedia` — opaque dark chip with light text, for labels over artwork
   *               (legible on any cover, in any theme); ignores `color`.
   */
  variant?: 'tinted' | 'solid' | 'outline' | 'onMedia';
  icon?: React.ReactNode;
  style?: ViewStyle;
}

/** Compact pill label — used for genres, formats, scores, statuses. */
export function Badge({ label, color, variant = 'tinted', icon, style }: BadgeProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const tint = color ?? colors.textMuted;
  const isSolid = variant === 'solid';
  const isOutline = variant === 'outline';
  const isOnMedia = variant === 'onMedia';
  return (
    <View
      style={[
        styles.badge,
        isSolid && { backgroundColor: tint },
        isOnMedia && { backgroundColor: colors.mediaScrim },
        !isSolid && !isOutline && !isOnMedia && { backgroundColor: withAlpha(tint, 0.16) },
        isOutline && { borderWidth: 1, borderColor: withAlpha(tint, 0.4) },
        style,
      ]}
    >
      {icon}
      <Text
        variant="overline"
        color={isSolid ? colors.onAccent : isOnMedia ? colors.onMedia : tint}
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

const useStyles = makeStyles(({ radii }) => ({
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
}));
