import { View, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { spacing } from '../theme';
import { PosterCard } from './PosterCard';
import { SectionHeader } from './SectionHeader';
import { useSimilarTo } from '../api/anilist/hooks';

interface RecommendationsRailProps {
  mediaId: number;
}

/**
 * "More like this" rail for the detail screen — AniList's community-rated
 * recommendations for the current title. Renders nothing until there's at least
 * one recommendation, so a title with none simply omits the section.
 */
export function RecommendationsRail({ mediaId }: RecommendationsRailProps) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(124, Math.round((width - spacing.xl * 2) / 3.2));

  const { data } = useSimilarTo(mediaId);
  const items = data ?? [];

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title="More like this" caption="Fans also watched" />
      <FlatList
        data={items}
        keyExtractor={(item) => `rec-${item.media.id}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        renderItem={({ item }) => <PosterCard media={item.media} width={cardWidth} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing['2xl'] },
  rail: { gap: spacing.md, paddingRight: spacing.xl },
});
