import { Pressable, View, StyleSheet, Linking } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './ui/Text';
import { withAlpha } from './ui/Badge';
import { radii, spacing, makeStyles, useTheme } from '../theme';
import type { MediaTrailer } from '../api/anilist';

/**
 * External watch URL for an AniList trailer, or `null` when it can't be played —
 * no trailer object, a trailer with no id (e.g. an announced season that has no
 * trailer yet), or an unrecognized host we can't build a link for. Callers use
 * the null to render nothing (no dead button).
 */
export function trailerUrl(trailer?: MediaTrailer | null): string | null {
  if (!trailer?.id || !trailer.site) return null;
  if (trailer.site === 'youtube') return `https://youtu.be/${trailer.id}`;
  if (trailer.site === 'dailymotion') return `https://dai.ly/${trailer.id}`;
  return null;
}

/** "Watch trailer" tile. Renders nothing when there's no playable trailer. */
export function TrailerCard({ trailer }: { trailer?: MediaTrailer | null }) {
  const url = trailerUrl(trailer);
  const styles = useStyles();
  const { colors } = useTheme();
  if (!url) return null;

  return (
    <View style={styles.section}>
      <Text variant="heading" style={styles.title}>
        Trailer
      </Text>
      <Pressable
        onPress={() => Linking.openURL(url)}
        style={styles.tile}
        accessibilityRole="button"
        accessibilityLabel="Watch trailer"
      >
        {trailer?.thumbnail ? (
          <Image
            source={trailer.thumbnail}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : null}
        <LinearGradient
          colors={['transparent', withAlpha(colors.bg, 0.45)]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.playBtn, { backgroundColor: withAlpha(colors.bg, 0.55) }]}>
          <Ionicons name="play" size={26} color={colors.text} style={styles.playIcon} />
        </View>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  section: { marginTop: spacing['2xl'] },
  title: { marginBottom: spacing.sm },
  tile: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  playIcon: { marginLeft: 3 },
}));
