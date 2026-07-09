import { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { Screen } from '../../src/components/ui/Screen';
import { Text } from '../../src/components/ui/Text';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { PressableScale } from '../../src/components/ui/PressableScale';
import { SearchBar } from '../../src/components/SearchBar';
import { SectionHeader } from '../../src/components/SectionHeader';
import { FeaturedCard } from '../../src/components/FeaturedCard';
import { PosterCard } from '../../src/components/PosterCard';
import { EmptyState } from '../../src/components/EmptyState';
import { useSeasonal, useTrending, useSearchAnime, flattenPages } from '../../src/api/anilist/hooks';
import { currentSeason, type Media } from '../../src/api/anilist';
import { useUnreadCount } from '../../src/features/notifications/store';
import { radii, spacing, useTheme } from '../../src/theme';

const H_PADDING = spacing.xl;
const COL_GAP = spacing.md;
const BOTTOM_SPACE = 110;

export default function DiscoverScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { colors, gradients, retro } = useTheme();
  const [query, setQuery] = useState('');
  const isSearching = query.trim().length >= 2;

  const trending = useTrending();
  const seasonal = useSeasonal();
  const search = useSearchAnime(query);
  const { season, year } = currentSeason();
  const unreadCount = useUnreadCount();

  const columns = width >= 700 ? 4 : 3;
  const posterWidth = useMemo(
    () => (width - H_PADDING * 2 - COL_GAP * (columns - 1)) / columns,
    [width, columns],
  );
  const featuredWidth = Math.min(width - H_PADDING * 2, 520);

  const seasonLabel = `${season.charAt(0) + season.slice(1).toLowerCase()} ${year}`;

  const seasonalItems = useMemo(() => flattenPages(seasonal.data, (m) => m.id), [seasonal.data]);
  const searchItems = useMemo(() => flattenPages(search.data, (m) => m.id), [search.data]);
  const gridData: Media[] = isSearching ? searchItems : seasonalItems;

  // The query that drives the grid — its paging + refresh control the list below.
  const gridQuery = isSearching ? search : seasonal;
  const loadMore = () => {
    if (gridQuery.hasNextPage && !gridQuery.isFetchingNextPage) gridQuery.fetchNextPage();
  };

  // Vertical scroll drives the hero parallax/fade.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 160], [1, 0], 'clamp'),
    transform: [{ translateY: scrollY.value * -0.4 }],
  }));
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 110], [1, 0], 'clamp'),
    transform: [{ translateY: interpolate(scrollY.value, [0, 110], [0, -18], 'clamp') }],
  }));

  return (
    <Screen>
      {/* Accent glow behind the hero (uses the per-theme heroGlow gradient). */}
      <Animated.View style={[styles.glowWrap, glowStyle]}>
        <LinearGradient colors={gradients.heroGlow} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.FlatList
        data={gridData}
        keyExtractor={(item: Media) => String(item.id)}
        numColumns={columns}
        key={columns} // remount if column count changes (orientation / web resize)
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={gridQuery.isRefetching && !gridQuery.isFetchingNextPage}
            onRefresh={() => gridQuery.refetch()}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListFooterComponent={
          gridQuery.isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.footer} />
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Animated.View style={[styles.topRow, heroStyle]}>
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
              <View style={styles.headerActions}>
                <PressableScale
                  onPress={() => router.push('/notifications')}
                  accessibilityRole="button"
                  accessibilityLabel={
                    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
                  }
                  style={[styles.bellBtn, { backgroundColor: colors.surfaceHigh }]}
                >
                  <Ionicons
                    name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
                    size={20}
                    color={colors.text}
                  />
                  {unreadCount > 0 && (
                    <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                      <Text variant="caption" color={colors.onAccent} style={styles.badgeText}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </PressableScale>
                <PressableScale
                  onPress={() => router.push('/settings')}
                  accessibilityRole="button"
                  accessibilityLabel="Settings"
                >
                  <LinearGradient
                    colors={gradients.brand}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatar}
                  >
                    <Ionicons name="settings-sharp" size={20} color={colors.onMedia} />
                  </LinearGradient>
                </PressableScale>
              </View>
            </Animated.View>

            <SearchBar value={query} onChangeText={setQuery} />

            {!isSearching && (
              <PressableScale
                onPress={() => router.push('/for-you')}
                accessibilityRole="button"
                accessibilityLabel="For You recommendations"
                style={styles.forYouBanner}
              >
                <LinearGradient
                  colors={gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.forYouGradient,
                    retro && { borderRadius: 2, borderWidth: 3, borderColor: colors.borderStrong },
                  ]}
                >
                  <View style={styles.forYouIcon}>
                    <Ionicons name="sparkles" size={20} color={colors.onMedia} />
                  </View>
                  <View style={styles.forYouText}>
                    <Text variant="callout" color={colors.onMedia}>
                      For You
                    </Text>
                    <Text variant="caption" color={colors.onMediaMuted}>
                      Recommendations picked from your list
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.onMedia} />
                </LinearGradient>
              </PressableScale>
            )}

            {!isSearching && (
              <View style={styles.trendingBlock}>
                <SectionHeader title="Trending now" caption="What everyone's watching" />
                {trending.isLoading ? (
                  <FeaturedSkeleton width={featuredWidth} />
                ) : (
                  <TrendingCarousel
                    items={trending.data?.items.slice(0, 8) ?? []}
                    width={featuredWidth}
                    gap={COL_GAP}
                  />
                )}
              </View>
            )}

            <View style={[styles.sectionTitle, styles.sectionRow]}>
              <SectionHeader
                title={isSearching ? 'Results' : 'Popular this season'}
                caption={isSearching ? `“${query.trim()}”` : seasonLabel}
              />
              {!isSearching && (
                <View style={styles.browseLinks}>
                  <PressableScale
                    onPress={() => router.push('/seasons')}
                    accessibilityRole="button"
                    accessibilityLabel="Browse seasons"
                    style={styles.browseLink}
                  >
                    <Text variant="caption" color={colors.accent}>
                      Seasons
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                  </PressableScale>
                  <PressableScale
                    onPress={() => router.push('/browse')}
                    accessibilityRole="button"
                    accessibilityLabel="Browse genres"
                    style={styles.browseLink}
                  >
                    <Text variant="caption" color={colors.accent}>
                      Genres
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                  </PressableScale>
                </View>
              )}
            </View>
          </View>
        }
        renderItem={({ item }: { item: Media }) => (
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

/** Horizontal trending rail where the centered card is emphasized as you scroll. */
function TrendingCarousel({ items, width, gap }: { items: Media[]; width: number; gap: number }) {
  const interval = width + gap;
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  return (
    <Animated.FlatList
      data={items}
      keyExtractor={(item: Media) => String(item.id)}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={interval}
      decelerationRate="fast"
      contentContainerStyle={styles.carousel}
      onScroll={onScroll}
      scrollEventThrottle={16}
      renderItem={({ item, index }: { item: Media; index: number }) => (
        <FocusCard scrollX={scrollX} index={index} interval={interval} width={width}>
          <FeaturedCard media={item} width={width} rank={index + 1} />
        </FocusCard>
      )}
    />
  );
}

/** Scales + fades a carousel child based on its distance from the snapped position. */
function FocusCard({
  scrollX,
  index,
  interval,
  width,
  children,
}: {
  scrollX: SharedValue<number>;
  index: number;
  interval: number;
  width: number;
  children: React.ReactNode;
}) {
  const animStyle = useAnimatedStyle(() => {
    const input = [(index - 1) * interval, index * interval, (index + 1) * interval];
    return {
      transform: [{ scale: interpolate(scrollX.value, input, [0.93, 1, 0.93], 'clamp') }],
      opacity: interpolate(scrollX.value, input, [0.6, 1, 0.6], 'clamp'),
    };
  });
  return <Animated.View style={[{ width }, animStyle]}>{children}</Animated.View>;
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
  glowWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 340,
    pointerEvents: 'none',
  },
  content: {
    paddingHorizontal: H_PADDING,
    paddingBottom: BOTTOM_SPACE,
  },
  header: {
    paddingTop: spacing.md,
    gap: spacing.xl,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
  },
  trendingBlock: {
    gap: 0,
  },
  forYouBanner: {
    marginTop: spacing.lg,
  },
  forYouGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  forYouIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  forYouText: {
    flex: 1,
    gap: 2,
  },
  carousel: {
    gap: COL_GAP,
    paddingRight: spacing.sm,
  },
  sectionTitle: {
    marginTop: spacing.sm,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  browseLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  browseLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
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
  footer: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
