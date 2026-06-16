import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { radii, spacing, useTheme } from '../theme';
import { Text } from './ui/Text';
import { Badge } from './ui/Badge';
import { BottomSheet } from './ui/BottomSheet';
import { humanizeEnum } from '../lib/format';
import type { CharacterEdge } from '../api/anilist';

interface CharacterSheetProps {
  edge: CharacterEdge | null;
  visible: boolean;
  onClose: () => void;
}

/**
 * Bottom-sheet detail for a tapped character: portrait + name + role, then the
 * Japanese voice actor(s) who play them. `shown` latches the last character so
 * the content doesn't blank out while BottomSheet plays its close animation
 * (`edge` is reset to null by onClose).
 */
export function CharacterSheet({ edge, visible, onClose }: CharacterSheetProps) {
  const { colors } = useTheme();
  const [shown, setShown] = useState<CharacterEdge | null>(edge);

  useEffect(() => {
    if (edge) setShown(edge);
  }, [edge]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {shown && (
        <>
          <View style={styles.header}>
            <View style={[styles.portrait, { backgroundColor: colors.surface }]}>
              <Image
                source={shown.node.image?.large ?? undefined}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
            </View>
            <View style={styles.headerInfo}>
              <Text variant="caption" color="textFaint" uppercase>
                Character
              </Text>
              <Text variant="heading" numberOfLines={3}>
                {shown.node.name.full ?? '—'}
              </Text>
              {shown.role && (
                <Badge label={humanizeEnum(shown.role)} color={colors.accent} style={styles.roleBadge} />
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="caption" color="textFaint" uppercase style={styles.sectionLabel}>
              Voice actor (Japanese)
            </Text>
            {shown.voiceActors.length === 0 ? (
              <Text variant="callout" color="textMuted">
                No voice actor listed.
              </Text>
            ) : (
              shown.voiceActors.map((va) => (
                <View key={va.id} style={styles.vaRow}>
                  <View style={[styles.vaAvatar, { backgroundColor: colors.surface }]}>
                    <Image
                      source={va.image?.large ?? undefined}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={200}
                    />
                  </View>
                  <Text variant="bodyMedium" numberOfLines={2} style={styles.vaName}>
                    {va.name.full ?? '—'}
                  </Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  portrait: {
    width: 84,
    height: 112,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  headerInfo: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  roleBadge: { marginTop: spacing.xs },
  section: { marginTop: spacing.xl, gap: spacing.md },
  sectionLabel: { marginBottom: spacing.xs },
  vaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  vaAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  vaName: { flex: 1 },
});
