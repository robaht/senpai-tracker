import { useMemo, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Screen } from '../../src/components/ui/Screen';
import { Text } from '../../src/components/ui/Text';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { SearchBar } from '../../src/components/SearchBar';
import { SectionHeader } from '../../src/components/SectionHeader';
import { FeaturedCard } from '../../src/components/FeaturedCard';
import { PosterCard } from '../../src/components/PosterCard';
import { EmptyState } from '../../src/components/EmptyState';
import { useSeasonal, useTrending, useSearchAnime } from '../../src/api/anilist/hooks';
import { currentSeason, type Media } from '../../src/api/anilist';
import { colors, gradients, spacing } from '../../src/theme';

const H_PADDING = spacing.xl;
const COL_GAP = spacing.md;
const BOTTOM_SPACE = 110;

export default function DiscoverScreen() {
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const isSearching = query.trim().length >= 2;

  const trending = useTrending();
  const seasonal = useSeasonal();
  const search = useSearchAnime(query);
  const { season, year } = currentSeason();

  const columns = width >= 700 ? 4 : 3;
  const posterWidth = useMemo(
    () => (width - H_PADDING * 2 - COL_GAP * (columns - 1)) / columns,
    [width, columns],
  );
  const featuredWidth = Math.min(width - H_PADDING * 2, 520);

  const seasonLabel = `${season.charAt(0) + season.slice(1).toLowerCase()} ${year}`;

  const gridData: Media[] = isSearching ? (search.data?.items ?? []) : (seasonal.data?.items ?? []);

  return (
    <Screen>
      <FlatList
        data={gridData}
        keyExtractor={(item) => String(item.id)}
        numColumns={columns}
        key={columns} // remount if column count changes (orientation / web resize)
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.topRow}>
              <View>
                <Text variant="overline" color="textFaint">
                  WELCOME BACK
                </Text>
                <Text variant="display">
                  Senpai
                  <Text variant="display" color={colors.accent}>
                    .
                  </Text>
                </Text>
              </View>
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              />
            </View>

            <SearchBar value={query} onChangeText={setQuery} />

            {!isSearching && (
              <View style={styles.trendingBlock}>
                <SectionHeader title="Trending now" caption="What everyone's watching" />
                {trending.isLoading ? (
                  <FeaturedSkeleton width={featuredWidth} />
                ) : (
                  <FlatList
                    data={trending.data?.items.slice(0, 8) ?? []}
                    keyExtractor={(item) => String(item.id)}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={featuredWidth + COL_GAP}
                    decelerationRate="fast"
                    contentContainerStyle={styles.carousel}
                    renderItem={({ item, index }) => (
                      <FeaturedCard media={item} width={featuredWidth} rank={index + 1} />
                    )}
                  />
                )}
              </View>
            )}

            <View style={styles.sectionTitle}>
              <SectionHeader
                title={isSearching ? 'Results' : 'Popular this season'}
                caption={isSearching ? `“${query.trim()}”` : seasonLabel}
              />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Animated.View entering={FadeIn.duration(250)} style={{ width: posterWidth }}>
            <PosterCard media={item} width={posterWidth} />
          </Animated.View>
        )}
        ListEmptyComponent={
          isSearching ? (
            search.isFetching ? (
              <ActivityIndicator color={colors.accent} style={styles.spinner} />
            ) : (
              <EmptyState
                emoji="🔍"
                title="No matches"
                subtitle={`Nothing found for “${query.trim()}”. Try another title.`}
              />
            )
          ) : seasonal.isLoading ? (
            <PosterGridSkeleton width={posterWidth} columns={columns} />
          ) : null
        }
      />
    </Screen>
  );
}

function FeaturedSkeleton({ width }: { width: number }) {
  return <Skeleton width={width} height={width * 0.625} radius={20} />;
}

function PosterGridSkeleton({ width, columns }: { width: number; columns: number }) {
  return (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: columns * 3 }).map((_, i) => (
        <View key={i} style={{ width }}>
          <Skeleton width={width} height={width * 1.5} radius={12} />
          <Skeleton width={width * 0.8} height={12} style={{ marginTop: spacing.sm }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: H_PADDING,
    paddingBottom: BOTTOM_SPACE,
  },
  header: {
    paddingTop: spacing.md,
    gap: spacing.xl,
    marginHorizontal: -0, // keep header aligned with grid padding
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  trendingBlock: {
    gap: 0,
  },
  carousel: {
    gap: COL_GAP,
    paddingRight: spacing.sm,
  },
  sectionTitle: {
    marginTop: spacing.sm,
  },
  column: {
    gap: COL_GAP,
    marginBottom: spacing.lg,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COL_GAP,
  },
  spinner: {
    marginTop: spacing['4xl'],
  },
});
