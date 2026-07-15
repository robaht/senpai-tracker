import { useMemo, useState } from 'react';
import { View, FlatList, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { spacing, makeStyles, useTheme } from '../../src/theme';

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
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [genreSel, setGenreSel] = useState<string[]>([]);
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

  // Genres actually present in the library (F30), with entry counts, most
  // common first. Entries carry a denormalized `genres` snapshot, so this is
  // purely local — no AniList fetch. `?? []` guards pre-genres persisted entries.
  const genreCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of all) for (const g of e.genres ?? []) c.set(g, (c.get(g) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [all]);

  const toggleGenre = (g: string) =>
    setGenreSel((sel) => (sel.includes(g) ? sel.filter((x) => x !== g) : [...sel, g]));

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const genreFiltering = genreSel.length > 0;

  // filter (status) → genres (any-match) → search (title) → sort. Counts above
  // stay on the full list so the chip badges don't shift while searching.
  const filtered = useMemo(() => {
    const list = all.filter(
      (e) =>
        (filter === 'ALL' || e.status === filter) &&
        (!genreFiltering || (e.genres ?? []).some((g) => genreSel.includes(g))) &&
        (!searching || e.title.toLowerCase().includes(q)),
    );
    return list.sort(SORT_COMPARATORS[sortBy]);
  }, [all, filter, genreFiltering, genreSel, q, searching, sortBy]);

  // Only show status chips that actually have entries (keeps the bar tidy).
  const visibleStatuses = WATCH_STATUSES.filter((s) => counts[s] > 0);

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sortBy)!.label;
  // The "Continue watching" rail is a resume affordance, not a search result —
  // only surface it on the default unfiltered view.
  const showRail = filter === 'ALL' && !searching && !genreFiltering && sortBy === 'recent';

  return (
    <Screen>
      <View style={styles.headerWrap}>
        <View style={styles.titleRow}>
          <View>
            <Text variant="overline" color="textFaint">
              {all.length} {all.length === 1 ? 'TITLE' : 'TITLES'}
            </Text>
            <Text variant="display">Library</Text>
          </View>
          <View style={styles.headerBtns}>
            <Pressable
              onPress={() => router.push('/comfort')}
              style={styles.statsBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open your Comfort Corner"
            >
              <Ionicons name="cafe" size={20} color={colors.accentAlt} />
            </Pressable>
            {all.length > 0 && (
              <Pressable
                onPress={() => router.push('/stats')}
                style={styles.statsBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="View your stats"
              >
                <Ionicons name="stats-chart" size={20} color={colors.text} />
              </Pressable>
            )}
          </View>
        </View>

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

      {all.length > 0 && genreCounts.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsBar}
          contentContainerStyle={[styles.chips, styles.genreChips]}
        >
          {genreFiltering && (
            <Pressable
              onPress={() => setGenreSel([])}
              style={styles.clearChip}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Clear genre filters"
            >
              <Ionicons name="close" size={14} color={colors.textMuted} />
            </Pressable>
          )}
          {genreCounts.map(([g, n]) => (
            <Chip
              key={g}
              label={g}
              count={n}
              active={genreSel.includes(g)}
              color={colors.accentAlt}
              onPress={() => toggleGenre(g)}
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
            ) : genreFiltering ? (
              <EmptyState
                emoji="🏷️"
                title="No matches"
                subtitle={`Nothing ${filter === 'ALL' ? 'in your list' : 'with this status'} matches ${genreSel.join(' or ')}.`}
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

const useStyles = makeStyles(({ colors, radii }) => ({
  headerWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statsBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Genre row sits directly under the status row — drop the doubled-up gap.
  genreChips: {
    paddingTop: 0,
  },
  clearChip: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  countBubble: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
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
