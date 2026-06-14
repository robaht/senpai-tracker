import { useMemo } from 'react';
import { View, Pressable, StyleSheet, Linking } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './ui/Text';
import { withAlpha } from './ui/Badge';
import { SectionHeader } from './SectionHeader';
import { useRegion } from '../features/preferences/store';
import { resolveStreaming, regionLabel, type StreamingOption } from '../lib/streaming';
import { radii, spacing, makeStyles, useTheme } from '../theme';
import type { ExternalLink } from '../api/anilist';

/**
 * "Where to watch" — region-aware streaming links for the detail screen.
 *
 * Shows services available in the user's region first. When nothing streams in
 * region, falls back to services the user can still reach whose listing is for
 * another region (flagged as possibly needing a VPN). When the title has no
 * streaming links at all — or none on a service available locally — it says so
 * plainly rather than rendering a dead section.
 */
export function StreamingLinks({ links }: { links?: ExternalLink[] }) {
  const region = useRegion();
  const styles = useStyles();
  const { colors } = useTheme();

  const result = useMemo(() => resolveStreaming(links, region), [links, region]);

  const usingFallback = result.inRegion.length === 0 && result.otherRegion.length > 0;
  const options = result.inRegion.length > 0 ? result.inRegion : result.otherRegion;

  const caption = region ? `${regionLabel(region).flag} ${regionLabel(region).label}` : undefined;

  return (
    <View style={styles.section}>
      <SectionHeader title="Where to watch" caption={caption} />

      {result.isEmpty ? (
        <Text variant="callout" color="textFaint">
          No streaming links for this title yet.
        </Text>
      ) : options.length === 0 ? (
        // Links exist, but none on a service available in this region.
        <Text variant="callout" color="textFaint">
          Not available on streaming services in your region.
        </Text>
      ) : (
        <>
          {usingFallback && (
            <View style={styles.note}>
              <Ionicons name="information-circle-outline" size={15} color={colors.textFaint} />
              <Text variant="caption" color="textFaint" style={styles.noteText}>
                Not on services in your region — these list it elsewhere and may need a VPN.
              </Text>
            </View>
          )}
          <View style={styles.chips}>
            {options.map((opt) => (
              <ServiceChip key={opt.link.id} option={opt} muted={usingFallback} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

/** A single tappable streaming service pill (brand-tinted, opens the URL). */
function ServiceChip({ option, muted }: { option: StreamingOption; muted: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { link, service } = option;
  const brand = link.color ?? colors.textMuted;

  return (
    <Pressable
      onPress={() => Linking.openURL(link.url)}
      style={({ pressed }) => [
        styles.chip,
        muted
          ? { borderWidth: 1, borderColor: withAlpha(brand, 0.4) }
          : { backgroundColor: withAlpha(brand, 0.16) },
        pressed && styles.chipPressed,
      ]}
      accessibilityRole="link"
      accessibilityLabel={`Watch on ${service}`}
    >
      {link.icon ? (
        <Image source={link.icon} style={styles.icon} contentFit="contain" transition={150} />
      ) : null}
      <Text variant="callout" color={brand} numberOfLines={1}>
        {service}
      </Text>
      {link.notes ? (
        <Text variant="caption" color="textFaint" numberOfLines={1}>
          {link.notes}
        </Text>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  section: { marginTop: spacing['2xl'] },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  noteText: { flex: 1 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
  },
  chipPressed: { opacity: 0.6 },
  icon: { width: 18, height: 18, borderRadius: 4 },
}));
