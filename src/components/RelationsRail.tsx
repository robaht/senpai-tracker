import { useMemo } from 'react';
import { View, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { colors, spacing } from '../theme';
import { Badge } from './ui/Badge';
import { PosterCard } from './PosterCard';
import { SectionHeader } from './SectionHeader';
import { humanizeEnum } from '../lib/format';
import { buildSeasonChain, sortRelations } from '../lib/relations';
import type { Media, MediaRelationEdge } from '../api/anilist';

interface RelationsRailProps {
  media: Media;
}

/**
 * "Seasons" (ordered prequel→current→sequel) and "Related" rails for the detail
 * screen. Renders nothing when the title has no anime relations. When a season
 * chain exists, prequel/sequel edges move into the Seasons rail so the two
 * sections stay complementary (Related becomes side stories, movies, spin-offs).
 */
export function RelationsRail({ media }: RelationsRailProps) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(124, Math.round((width - spacing.xl * 2) / 3.2));

  const edges = media.relations ?? [];
  const chain = useMemo(() => buildSeasonChain(media, edges), [media, edges]);
  const hasChain = chain.length >= 2;

  const related = useMemo(
    () =>
      sortRelations(edges).filter(
        (e) => !(hasChain && (e.relationType === 'PREQUEL' || e.relationType === 'SEQUEL')),
      ),
    [edges, hasChain],
  );

  if (!hasChain && related.length === 0) return null;

  return (
    <View>
      {hasChain && (
        <View style={styles.section}>
          <SectionHeader title="Seasons" caption="In watch order" />
          <FlatList
            data={chain}
            keyExtractor={(item) => `season-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            renderItem={({ item }) => (
              <SeasonCard media={item} width={cardWidth} isCurrent={item.id === media.id} />
            )}
          />
        </View>
      )}

      {related.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Related" />
          <FlatList
            data={related}
            keyExtractor={(item) => `rel-${item.relationType}-${item.node.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            renderItem={({ item }) => <RelationCard edge={item} width={cardWidth} />}
          />
        </View>
      )}
    </View>
  );
}

/** Poster + relation-type badge overlay. */
function RelationCard({ edge, width }: { edge: MediaRelationEdge; width: number }) {
  return (
    <View style={{ width }}>
      <PosterCard media={edge.node} width={width} />
      <View style={styles.badgeSlot} pointerEvents="none">
        <Badge label={humanizeEnum(edge.relationType)} color={colors.surfaceHigh} variant="solid" />
      </View>
    </View>
  );
}

/** Poster within the season chain; the current title is marked. */
function SeasonCard({
  media,
  width,
  isCurrent,
}: {
  media: Media;
  width: number;
  isCurrent: boolean;
}) {
  return (
    <View style={{ width }}>
      <PosterCard media={media} width={width} />
      {isCurrent && (
        <View style={styles.badgeSlot} pointerEvents="none">
          <Badge label="Current" color={colors.accent} variant="solid" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing['2xl'] },
  rail: { gap: spacing.md, paddingRight: spacing.xl },
  badgeSlot: {
    position: 'absolute',
    top: spacing.xs + 2,
    left: spacing.xs + 2,
  },
});
