import { useMemo, useState } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useGoBack } from '../src/lib/useGoBack';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { cardEntering } from '../src/lib/motion';
import { Screen } from '../src/components/ui/Screen';
import { Text } from '../src/components/ui/Text';
import { Skeleton } from '../src/components/ui/Skeleton';
import { PosterCard } from '../src/components/PosterCard';
import { withAlpha } from '../src/components/ui/Badge';
import { BrowseSortSheet, BROWSE_SORT_OPTIONS } from '../src/components/BrowseSortSheet';
import { useBrowse, useGenres, flattenPages } from '../src/api/anilist/hooks';
import type { BrowseFilters, Media, MediaSort } from '../src/api/anilist';
import { radii, spacing, useTheme } from '../src/theme';

const H_PADDING = spacing.xl;
const COL_GAP = spacing.md;
const BOTTOM_SPACE = 110;

export default function BrowseScreen() {
  const { width } = useWindowDimensions();
  const goBack = useGoBack();
  const { colors } = useTheme();

  const [genres, setGenres] = useState<string[]>([]);
  const [sort, setSort] = useState<MediaSort>('POPULARITY_DESC');
  const [sortOpen, setSortOpen] = useState(false);

  const filters = useMemo<BrowseFilters>(() => ({ genres, sort }), [genres, sort]);

  const genreList = useGenres();
  const result = useBrowse(filters);
  const items = useMemo(() => flattenPages(result.data, (m) => m.id), [result.data]);

  const sortLabel = BROWSE_SORT_OPTIONS.find((o) => o.key === sort)?.label ?? 'Sort';

  const columns = width >= 700 ? 4 : 3;
  const posterWidth = useMemo(
    () => (width - H_PADDING * 2 - COL_GAP * (columns - 1)) / columns,
    [width, columns],
  );

  const toggleGenre = (g: string) =>
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const reset = () => {
    setGenres([]);
    setSort('POPULARITY_DESC');
  };

  const hasFilters = genres.length > 0 || sort !== 'POPULARITY_DESC';

  const loadMore = () => {
    if (result.hasNextPage && !result.isFetchingNextPage) result.fetchNextPage();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Pressable
            onPress={goBack}
            style={[styles.iconBtn, { backgroundColor: colors.surface }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text variant="display">Browse</Text>
        </View>

        {/* Sort + reset row */}
        <View style={styles.controls}>
          <Pressable
            onPress={() => setSortOpen(true)}
            style={[styles.sortBtn, { backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${sortLabel}`}
          >
            <Ionicons name="swap-vertical" size={16} color={colors.textMuted} />
            <Text variant="caption" color="textMuted">
              {sortLabel}
            </Text>
          </Pressable>
          {hasFilters && (
            <Pressable
              onPress={reset}
              style={styles.resetBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Reset filters"
            >
              <Text variant="caption" color={colors.accent}>
                Reset
              </Text>
            </Pressable>
          )}
        </View>

        {/* Genre chip multi-select */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {(genreList.data ?? []).map((g) => {
            const active = genres.includes(g);
            return (
              <Pressable
                key={g}
                onPress={() => toggleGenre(g)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? withAlpha(colors.accent, 0.16) : colors.surface,
                    borderColor: active ? colors.accent : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={g}
              >
                <Text variant="caption" color={active ? colors.accent : colors.textMuted}>
                  {g}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Animated.FlatList
        data={items}
        keyExtractor={(item: Media) => String(item.id)}
        numColumns={columns}
        key={columns}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={result.isRefetching && !result.isFetchingNextPage}
            onRefresh={() => result.refetch()}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListFooterComponent={
          result.isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.footer} />
          ) : null
        }
        renderItem={({ item }: { item: Media }) => (
          <Animated.View entering={cardEntering} style={{ width: posterWidth }}>
            <PosterCard media={item} width={posterWidth} />
          </Animated.View>
        )}
        ListEmptyComponent={
          result.isLoading ? (
            <PosterGridSkeleton width={posterWidth} columns={columns} />
          ) : (
            <View style={styles.empty}>
              <Text variant="callout" color="textMuted">
                Nothing matches these filters.
              </Text>
            </View>
          )
        }
      />

      <BrowseSortSheet
        value={sort}
        visible={sortOpen}
        onSelect={setSort}
        onClose={() => setSortOpen(false)}
      />
    </Screen>
  );
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
  header: {
    paddingHorizontal: H_PADDING,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  resetBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  chips: {
    gap: spacing.sm,
    paddingRight: H_PADDING,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  content: {
    paddingHorizontal: H_PADDING,
    paddingTop: spacing.xl,
    paddingBottom: BOTTOM_SPACE,
  },
  column: {
    gap: COL_GAP,
    marginBottom: spacing.lg,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COL_GAP,
    paddingHorizontal: H_PADDING,
  },
  empty: {
    alignItems: 'center',
    marginTop: spacing['4xl'],
  },
  footer: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
