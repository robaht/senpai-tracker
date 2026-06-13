import { useMemo, useState } from 'react';
import { View, FlatList, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Screen } from '../../src/components/ui/Screen';
import { Text } from '../../src/components/ui/Text';
import { withAlpha } from '../../src/components/ui/Badge';
import { LibraryRow } from '../../src/components/LibraryRow';
import { EmptyState } from '../../src/components/EmptyState';
import { useTrackingStore } from '../../src/features/tracking/store';
import {
  STATUS_META,
  WATCH_STATUSES,
  statusColor,
  type WatchStatus,
} from '../../src/features/tracking/types';
import { spacing, makeStyles, useTheme } from '../../src/theme';

const BOTTOM_SPACE = 110;
type Filter = WatchStatus | 'ALL';

export default function LibraryScreen() {
  const entries = useTrackingStore((s) => s.entries);
  const hydrated = useTrackingStore((s) => s.hydrated);
  const { colors } = useTheme();
  const styles = useStyles();
  const [filter, setFilter] = useState<Filter>('ALL');

  const all = useMemo(
    () => Object.values(entries).sort((a, b) => b.updatedAt - a.updatedAt),
    [entries],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: all.length };
    for (const s of WATCH_STATUSES) c[s] = 0;
    for (const e of all) c[e.status] += 1;
    return c;
  }, [all]);

  const filtered = filter === 'ALL' ? all : all.filter((e) => e.status === filter);

  // Only show status chips that actually have entries (keeps the bar tidy).
  const visibleStatuses = WATCH_STATUSES.filter((s) => counts[s] > 0);

  return (
    <Screen>
      <View style={styles.headerWrap}>
        <Text variant="overline" color="textFaint">
          {all.length} {all.length === 1 ? 'TITLE' : 'TITLES'}
        </Text>
        <Text variant="display">Library</Text>
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
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          hydrated ? (
            <EmptyState
              emoji="📚"
              title={filter === 'ALL' ? 'Your library is empty' : 'Nothing here yet'}
              subtitle={
                filter === 'ALL'
                  ? 'Find a show on Discover and add it to start tracking.'
                  : 'No titles with this status.'
              }
            />
          ) : null
        }
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
