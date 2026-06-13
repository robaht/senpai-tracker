import { useMemo, useState } from 'react';
import { View, SectionList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Screen } from '../../src/components/ui/Screen';
import { Text } from '../../src/components/ui/Text';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { withAlpha } from '../../src/components/ui/Badge';
import { ScheduleRow } from '../../src/components/ScheduleRow';
import { EmptyState } from '../../src/components/EmptyState';
import { useAiringSchedule } from '../../src/api/anilist/hooks';
import { useTrackingStore } from '../../src/features/tracking/store';
import { airingDayLabel } from '../../src/lib/format';
import type { AiringScheduleItem } from '../../src/api/anilist';
import { colors, spacing } from '../../src/theme';

const BOTTOM_SPACE = 110;

export default function ScheduleScreen() {
  const { data, isLoading, isError, refetch } = useAiringSchedule(7);
  const entries = useTrackingStore((s) => s.entries);
  const [onlyTracked, setOnlyTracked] = useState(false);

  const sections = useMemo(() => {
    let items = data?.items ?? [];
    if (onlyTracked) items = items.filter((i) => !!entries[i.media.id]);

    const byDay = new Map<string, AiringScheduleItem[]>();
    for (const item of items) {
      const label = airingDayLabel(item.airingAt);
      const arr = byDay.get(label) ?? [];
      arr.push(item);
      byDay.set(label, arr);
    }
    return Array.from(byDay.entries()).map(([title, rows]) => ({ title, data: rows }));
  }, [data, onlyTracked, entries]);

  return (
    <Screen>
      <View style={styles.headerWrap}>
        <Text variant="overline" color="textFaint">
          NEXT 7 DAYS
        </Text>
        <Text variant="display">Schedule</Text>

        <View style={styles.filters}>
          <FilterPill label="All airing" active={!onlyTracked} onPress={() => setOnlyTracked(false)} />
          <FilterPill label="My list" active={onlyTracked} onPress={() => setOnlyTracked(true)} />
        </View>
      </View>

      {isLoading ? (
        <ScheduleSkeleton />
      ) : isError ? (
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
          onRefresh={refetch}
          refreshing={false}
          renderSectionHeader={({ section }) => (
            <Text variant="callout" color="accentSoft" style={styles.sectionHeader}>
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => <ScheduleRow item={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <EmptyState
              emoji={onlyTracked ? '🌙' : '✶'}
              title={onlyTracked ? 'Nothing from your list airs soon' : 'No episodes scheduled'}
              subtitle={
                onlyTracked
                  ? 'Add airing shows to your list to see their countdowns here.'
                  : 'Check back later for upcoming episodes.'
              }
            />
          }
        />
      )}
    </Screen>
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

const styles = StyleSheet.create({
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
    borderRadius: 999,
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
});
