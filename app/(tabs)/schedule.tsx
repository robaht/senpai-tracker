import { useMemo, useState } from 'react';
import { View, SectionList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Screen } from '../../src/components/ui/Screen';
import { Text } from '../../src/components/ui/Text';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { withAlpha } from '../../src/components/ui/Badge';
import { ScheduleRow } from '../../src/components/ScheduleRow';
import { EmptyState } from '../../src/components/EmptyState';
import { AddToListSheet } from '../../src/components/AddToListSheet';
import {
  useAiringSchedule,
  useTrackedAiringSchedule,
  useUpcomingPremieres,
  flattenPages,
} from '../../src/api/anilist/hooks';
import { useTrackingStore } from '../../src/features/tracking/store';
import { airingDayLabel, airingDateLabel } from '../../src/lib/format';
import type { AiringScheduleItem, Media } from '../../src/api/anilist';
import { spacing, makeStyles, useTheme } from '../../src/theme';

const BOTTOM_SPACE = 110;
const ALL_WINDOW_DAYS = 7;
/** "My list" uses a wider window — the result set is just the user's titles. */
const TRACKED_WINDOW_DAYS = 14;
/** "Upcoming" looks further out — premieres are sparser than weekly episodes. */
const UPCOMING_WINDOW_DAYS = 30;

type ScheduleView = 'all' | 'tracked' | 'upcoming';

export default function ScheduleScreen() {
  const entries = useTrackingStore((s) => s.entries);
  const styles = useStyles();
  const { colors } = useTheme();
  const [view, setView] = useState<ScheduleView>('all');
  const [addTarget, setAddTarget] = useState<Media | null>(null);

  const trackedIds = useMemo(() => Object.keys(entries).map(Number), [entries]);

  const all = useAiringSchedule(ALL_WINDOW_DAYS);
  // Ask AniList for exactly the tracked ids rather than filtering the global feed,
  // which is capped at one page and truncates before reaching most tracked titles.
  const tracked = useTrackedAiringSchedule(trackedIds, TRACKED_WINDOW_DAYS);
  const upcoming = useUpcomingPremieres(UPCOMING_WINDOW_DAYS);

  const active = view === 'tracked' ? tracked : view === 'upcoming' ? upcoming : all;
  const windowDays =
    view === 'tracked' ? TRACKED_WINDOW_DAYS : view === 'upcoming' ? UPCOMING_WINDOW_DAYS : ALL_WINDOW_DAYS;
  const hasTracked = trackedIds.length > 0;
  // An empty tracked list disables the query (never "loading"); treat as resolved.
  const isLoading = view === 'tracked' ? hasTracked && active.isLoading : active.isLoading;

  const loadMore = () => {
    if (active.hasNextPage && !active.isFetchingNextPage) active.fetchNextPage();
  };

  const sections = useMemo(() => {
    const items = flattenPages(active.data, (i) => i.id);
    // Premieres span a month, so weekday names would collide — group by date.
    const label = view === 'upcoming' ? airingDateLabel : airingDayLabel;
    const byDay = new Map<string, AiringScheduleItem[]>();
    for (const item of items) {
      const key = label(item.airingAt);
      const arr = byDay.get(key) ?? [];
      arr.push(item);
      byDay.set(key, arr);
    }
    return Array.from(byDay.entries()).map(([title, rows]) => ({ title, data: rows }));
  }, [active.data, view]);

  return (
    <Screen>
      <View style={styles.headerWrap}>
        <Text variant="overline" color="textFaint">
          {view === 'upcoming' ? 'UPCOMING PREMIERES' : `NEXT ${windowDays} DAYS`}
        </Text>
        <Text variant="display">Schedule</Text>

        <View style={styles.filters}>
          <FilterPill label="All airing" active={view === 'all'} onPress={() => setView('all')} />
          <FilterPill label="My list" active={view === 'tracked'} onPress={() => setView('tracked')} />
          <FilterPill label="Upcoming" active={view === 'upcoming'} onPress={() => setView('upcoming')} />
        </View>
      </View>

      {isLoading ? (
        <ScheduleSkeleton />
      ) : active.isError ? (
        <EmptyState
          emoji="📡"
          title="Couldn't load the schedule"
          subtitle="Check your connection and pull to retry."
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          onRefresh={() => active.refetch()}
          refreshing={active.isRefetching && !active.isFetchingNextPage}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          renderSectionHeader={({ section }) => (
            <Text variant="callout" color="accentSoft" style={styles.sectionHeader}>
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <ScheduleRow item={item} onAdd={view === 'upcoming' ? setAddTarget : undefined} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={
            active.isFetchingNextPage ? (
              <ActivityIndicator color={colors.accent} style={styles.footer} />
            ) : null
          }
          ListEmptyComponent={<ScheduleEmpty view={view} hasTracked={hasTracked} days={windowDays} />}
        />
      )}

      <AddToListSheet
        media={addTarget}
        visible={addTarget != null}
        onClose={() => setAddTarget(null)}
      />
    </Screen>
  );
}

/** Empty state that distinguishes "no list" from "nothing airing" for the tracked view. */
function ScheduleEmpty({
  view,
  hasTracked,
  days,
}: {
  view: ScheduleView;
  hasTracked: boolean;
  days: number;
}) {
  if (view === 'upcoming') {
    return (
      <EmptyState
        emoji="🌱"
        title="No premieres scheduled"
        subtitle={`Nothing new premieres in the next ${days} days. Check back soon.`}
      />
    );
  }
  if (view === 'all') {
    return (
      <EmptyState
        emoji="✶"
        title="No episodes scheduled"
        subtitle="Check back later for upcoming episodes."
      />
    );
  }
  if (!hasTracked) {
    return (
      <EmptyState
        emoji="📭"
        title="Your list is empty"
        subtitle="Add shows to your list to see their upcoming episodes here."
      />
    );
  }
  return (
    <EmptyState
      emoji="🌙"
      title={`Nothing from your list airs in ${days} days`}
      subtitle="None of your tracked titles have an upcoming episode. Completed and not-yet-released titles won't appear here."
    />
  );
}

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        active ? { backgroundColor: withAlpha(colors.accent, 0.18), borderColor: colors.accent } : null,
      ]}
    >
      <Text variant="callout" color={active ? colors.accentSoft : colors.textMuted}>
        {label}
      </Text>
    </Pressable>
  );
}

function ScheduleSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.content}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={46} height={64} radius={8} />
          <View style={styles.skeletonBody}>
            <Skeleton width="70%" height={16} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles(({ colors, radii }) => ({
  headerWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: BOTTOM_SPACE,
  },
  sectionHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  skeletonBody: {
    flex: 1,
    gap: spacing.sm,
  },
  footer: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
}));
