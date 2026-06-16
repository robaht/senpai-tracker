import { useMemo, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Screen } from '../src/components/ui/Screen';
import { Text } from '../src/components/ui/Text';
import { Skeleton } from '../src/components/ui/Skeleton';
import { PressableScale } from '../src/components/ui/PressableScale';
import { PosterCard } from '../src/components/PosterCard';
import { useSeasonalBrowse, flattenPages } from '../src/api/anilist/hooks';
import {
  currentSeason,
  prevSeason,
  nextSeason,
  type Media,
  type MediaSeason,
} from '../src/api/anilist';
import { radii, spacing, useTheme } from '../src/theme';

const H_PADDING = spacing.xl;
const COL_GAP = spacing.md;
const BOTTOM_SPACE = 110;

const SEASONS: MediaSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export default function SeasonsScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { colors } = useTheme();

  const today = useMemo(() => currentSeason(), []);
  const [current, setCurrent] = useState<{ season: MediaSeason; year: number }>(today);
  const { season, year } = current;

  const isToday = season === today.season && year === today.year;

  const columns = width >= 700 ? 4 : 3;
  const posterWidth = useMemo(
    () => (width - H_PADDING * 2 - COL_GAP * (columns - 1)) / columns,
    [width, columns],
  );

  const browse = useSeasonalBrowse(season, year);
  const items = useMemo(() => flattenPages(browse.data, (m) => m.id), [browse.data]);

  const loadMore = () => {
    if (browse.hasNextPage && !browse.isFetchingNextPage) browse.fetchNextPage();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.iconBtn, { backgroundColor: colors.surface }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text variant="display">Seasons</Text>
        </View>

        {/* Season + year pager */}
        <View style={styles.pager}>
          <Pressable
            onPress={() => setCurrent(prevSeason(current))}
            style={[styles.iconBtn, { backgroundColor: colors.surface }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Previous season"
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>

          <View style={styles.pagerLabel}>
            <Text variant="heading">{`${titleCase(season)} ${year}`}</Text>
            {!isToday && (
              <PressableScale onPress={() => setCurrent(today)} accessibilityLabel="Jump to current season">
                <Text variant="caption" color={colors.accent}>
                  Jump to current
                </Text>
              </PressableScale>
            )}
          </View>

          <Pressable
            onPress={() => setCurrent(nextSeason(current))}
            style={[styles.iconBtn, { backgroundColor: colors.surface }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Next season"
          >
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* Season segmented control (keeps the year, swaps the season) */}
        <View style={styles.segment}>
          {SEASONS.map((s) => {
            const active = s === season;
            return (
              <Pressable
                key={s}
                onPress={() => setCurrent({ season: s, year })}
                style={[
                  styles.segmentItem,
                  { backgroundColor: active ? colors.accent : colors.surface },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={titleCase(s)}
              >
                <Text variant="caption" color={active ? colors.onMedia : 'textMuted'}>
                  {titleCase(s)}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
            refreshing={browse.isRefetching && !browse.isFetchingNextPage}
            onRefresh={() => browse.refetch()}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListFooterComponent={
          browse.isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.footer} />
          ) : null
        }
        renderItem={({ item }: { item: Media }) => (
          <Animated.View entering={FadeIn.duration(250)} style={{ width: posterWidth }}>
            <PosterCard media={item} width={posterWidth} />
          </Animated.View>
        )}
        ListEmptyComponent={
          browse.isLoading ? (
            <PosterGridSkeleton width={posterWidth} columns={columns} />
          ) : (
            <View style={styles.empty}>
              <Text variant="callout" color="textMuted">
                Nothing here yet for this season.
              </Text>
            </View>
          )
        }
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
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pagerLabel: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
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
