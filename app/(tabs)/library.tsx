import { useMemo, useState } from 'react';
import { View, FlatList, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Screen } from '../../src/components/ui/Screen';
import { Text } from '../../src/components/ui/Text';
import { withAlpha } from '../../src/components/ui/Badge';
import { LibraryRow } from '../../src/components/LibraryRow';
import { ContinueWatchingRail } from '../../src/components/ContinueWatchingRail';
import { EmptyState } from '../../src/components/EmptyState';
import { SearchBar } from '../../src/components/SearchBar';
import { SortSheet, SORT_OPTIONS, type SortKey } from '../../src/components/SortSheet';
import { useTrackingStore } from '../../src/features/tracking/store';
import {
  STATUS_META,
  WATCH_STATUSES,
  statusColor,
  type WatchStatus,
} from '../../src/features/tracking/types';
import { radii, spacing, makeStyles, useTheme } from '../../src/theme';

import type { TrackEntry } from '../../src/features/tracking/types';

const BOTTOM_SPACE = 110;
type Filter = WatchStatus | 'ALL';

type Comparator = (a: TrackEntry, b: TrackEntry) => number;

const byRecent: Comparator = (a, b) => b.updatedAt - a.updatedAt;

const SORT_COMPARATORS: Record<SortKey, Comparator> = {
  recent: byRecent,
  title: (a, b) => a.title.localeCompare(b.title) || byRecent(a, b),
  // Unscored entries (score 0) naturally fall to the bottom of a desc sort.
  score: (a, b) => b.score - a.score || byRecent(a, b),
  progress: (a, b) => b.progress - a.progress || byRecent(a, b),
};

export default function LibraryScreen() {
  const entries = useTrackingStore((s) => s.entries);
  const hydrated = useTrackingStore((s) => s.hydrated);
  const { colors } = useTheme();
  const styles = useStyles();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [sortOpen, setSortOpen] = useState(false);

  const all = useMemo(() => Object.values(entries), [entries]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: all.length };
    for (const s of WATCH_STATUSES) c[s] = 0;
    for (const e of all) c[e.status] += 1;
    return c;
  }, [all]);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  // filter (status) → search (title) → sort. Counts above stay on the full
  // list so the chip badges don't shift while searching.
  const filtered = useMemo(() => {
    const list = all.filter(
      (e) =>
        (filter === 'ALL' || e.status === filter) &&
        (!searching || e.title.toLowerCase().includes(q)),
    );
    return list.sort(SORT_COMPARATORS[sortBy]);
  }, [all, filter, q, searching, sortBy]);

  // Only show status chips that actually have entries (keeps the bar tidy).
  const visibleStatuses = WATCH_STATUSES.filter((s) => counts[s] > 0);

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sortBy)!.label;
  // The "Continue watching" rail is a resume affordance, not a search result —
  // only surface it on the default unfiltered view.
  const showRail = filter === 'ALL' && !searching && sortBy === 'recent';

  return (
    <Screen>
      <View style={styles.headerWrap}>
        <Text variant="overline" color="textFaint">
          {all.length} {all.length === 1 ? 'TITLE' : 'TITLES'}
        </Text>
        <Text variant="display">Library</Text>

        {all.length > 0 && (
          <View style={styles.controls}>
            <View style={styles.searchFlex}>
              <SearchBar value={query} onChangeText={setQuery} placeholder="Search your list…" />
            </View>
            <Pressable
              onPress={() => setSortOpen(true)}
              style={styles.sortBtn}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${sortLabel}`}
            >
              <Text variant="callout" color="textFaint">
                ⇅
              </Text>
              <Text variant="callout" color="textMuted">
                {sortLabel}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {all.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsBar}
          contentContainerStyle={styles.chips}
        >
          <Chip label="All" count={counts.ALL} active={filter === 'ALL'} color={colors.accent} onPress={() => setFilter('ALL')} />
          {visibleStatuses.map((s) => (
            <Chip
              key={s}
              label={STATUS_META[s].short}
              count={counts[s]}
              active={filter === s}
              color={statusColor(colors, s)}
              onPress={() => setFilter(s)}
            />
          ))}
        </ScrollView>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.mediaId)}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <LibraryRow entry={item} />}
        ListHeaderComponent={showRail ? <ContinueWatchingRail /> : null}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          hydrated ? (
            searching ? (
              <EmptyState
                emoji="🔍"
                title="No matches"
                subtitle={`Nothing in your list matches “${query.trim()}”.`}
              />
            ) : (
              <EmptyState
                emoji="📚"
                title={filter === 'ALL' ? 'Your library is empty' : 'Nothing here yet'}
                subtitle={
                  filter === 'ALL'
                    ? 'Find a show on Discover and add it to start tracking.'
                    : 'No titles with this status.'
                }
              />
            )
          ) : null
        }
      />

      <SortSheet
        value={sortBy}
        visible={sortOpen}
        onSelect={setSortBy}
        onClose={() => setSortOpen(false)}
      />
    </Screen>
  );
}

function Chip({
  label,
  count,
  active,
  color,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active ? { backgroundColor: withAlpha(color, 0.18), borderColor: color } : null,
      ]}
    >
      <Text variant="callout" color={active ? colors.text : colors.textMuted}>
        {label}
      </Text>
      <View style={[styles.countBubble, active && { backgroundColor: withAlpha(color, 0.3) }]}>
        <Text variant="caption" color={active ? colors.text : colors.textFaint}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  headerWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  searchFlex: {
    flex: 1,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipsBar: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chips: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  countBubble: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: BOTTOM_SPACE,
    flexGrow: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
}));
