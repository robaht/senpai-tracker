import { useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { radii, spacing, useTheme } from '../theme';
import { Text } from './ui/Text';
import { PressableScale } from './ui/PressableScale';
import { SectionHeader } from './SectionHeader';
import { CharacterSheet } from './CharacterSheet';
import type { CharacterEdge, Media } from '../api/anilist';

interface CharacterRailProps {
  media: Media;
}

/**
 * Horizontal "Characters" rail for the detail screen — portrait + name, capped
 * to the top ~12 by role (the detail fetch already limits `perPage`). Tapping a
 * character opens a sheet with their role and Japanese voice actor(s). Renders
 * nothing when the title has no characters.
 */
export function CharacterRail({ media }: CharacterRailProps) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(96, Math.round((width - spacing.xl * 2) / 3.6));

  const characters = media.characters ?? [];
  const [selected, setSelected] = useState<CharacterEdge | null>(null);

  if (characters.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title="Characters" />
      <FlatList
        data={characters}
        keyExtractor={(item) => `char-${item.node.id}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        renderItem={({ item }) => (
          <CharacterCard edge={item} width={cardWidth} onPress={() => setSelected(item)} />
        )}
      />
      <CharacterSheet edge={selected} visible={selected != null} onClose={() => setSelected(null)} />
    </View>
  );
}

/** Portrait + character name; the lead voice actor shows faintly beneath. */
function CharacterCard({
  edge,
  width,
  onPress,
}: {
  edge: CharacterEdge;
  width: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const va = edge.voiceActors[0];
  return (
    <PressableScale
      style={{ width }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={edge.node.name.full ?? 'Character'}
    >
      <View style={[styles.portraitWrap, { width, height: width * 1.34, backgroundColor: colors.surface }]}>
        <Image
          source={edge.node.image?.large ?? undefined}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      </View>
      <Text variant="caption" numberOfLines={2} style={styles.name}>
        {edge.node.name.full ?? '—'}
      </Text>
      {va?.name.full && (
        <Text variant="overline" color="textFaint" numberOfLines={1}>
          {va.name.full}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing['2xl'] },
  rail: { gap: spacing.md, paddingRight: spacing.xl },
  portraitWrap: {
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  name: { marginTop: spacing.xs },
});
