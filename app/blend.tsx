import { useMemo, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useGoBack } from '../src/lib/useGoBack';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { cardEntering } from '../src/lib/motion';
import { Screen } from '../src/components/ui/Screen';
import { Text } from '../src/components/ui/Text';
import { PosterCard } from '../src/components/PosterCard';
import { useBlend } from '../src/features/recommendations/hooks';
import { useTrackingStore } from '../src/features/tracking/store';
import type { TrackEntry } from '../src/features/tracking/types';
import { radii, spacing, useTheme } from '../src/theme';

const H_PADDING = spacing.xl;
const COL_GAP = spacing.md;
const BOTTOM_SPACE = 110;

type Slot = { mediaId: number; title: string; coverImage: string | null } | null;

function toSlot(e: TrackEntry): Slot {
  return { mediaId: e.mediaId, title: e.title, coverImage: e.coverImage };
}

export default function BlendScreen() {
  const { width } = useWindowDimensions();
  const goBack = useGoBack();
  const { colors } = useTheme();

  const entries = useTrackingStore((s) => s.entries);
  const tracked = useMemo(
    () => Object.values(entries).sort((a, b) => b.updatedAt - a.updatedAt),
    [entries],
  );

  const [a, setA] = useState<Slot>(null);
  const [b, setB] = useState<Slot>(null);
  const [picking, setPicking] = useState<'A' | 'B' | null>(null);

  const { items, isLoading } = useBlend(a?.mediaId ?? null, b?.mediaId ?? null);

  const columns = width >= 700 ? 4 : 3;
  const posterWidth = useMemo(
    () => (width - H_PADDING * 2 - COL_GAP * (columns - 1)) / columns,
    [width, columns],
  );

  const choose = (e: TrackEntry) => {
    if (picking === 'A') setA(toSlot(e));
    else if (picking === 'B') setB(toSlot(e));
    setPicking(null);
  };

  const bothPicked = a && b;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => (picking ? setPicking(null) : goBack())}
            style={[styles.iconBtn, { backgroundColor: colors.surface }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={picking ? 'Cancel picking' : 'Go back'}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View>
            <Text variant="display">Blend</Text>
            <Text variant="caption" color="textMuted">
              {picking ? 'Pick a title you love' : 'Where two faves meet'}
            </Text>
          </View>
        </View>

        {!picking && (
          <View style={styles.slots}>
            <SlotButton slot={a} label="First pick" onPress={() => setPicking('A')} colors={colors} />
            <Ionicons name="add" size={22} color={colors.textMuted} />
            <SlotButton slot={b} label="Second pick" onPress={() => setPicking('B')} colors={colors} />
          </View>
        )}
      </View>

      {picking ? (
        <FlatList
          data={tracked}
          keyExtractor={(item) => String(item.mediaId)}
          contentContainerStyle={styles.pickerContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => choose(item)}
              style={[styles.pickRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <Image
                source={item.coverImage ?? undefined}
                style={[styles.pickPoster, { backgroundColor: item.coverColor ?? colors.surfaceElevated }]}
                contentFit="cover"
              />
              <Text variant="bodyMedium" numberOfLines={2} style={styles.pickTitle}>
                {item.title}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text variant="body" color="textMuted" style={styles.emptyText}>
                Your list is empty. Track a few anime first.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={bothPicked ? items : []}
          keyExtractor={(item) => String(item.media.id)}
          numColumns={columns}
          key={columns}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Animated.View entering={cardEntering} style={{ width: posterWidth }}>
              <PosterCard media={item.media} width={posterWidth} />
            </Animated.View>
          )}
          ListEmptyComponent={
            !bothPicked ? (
              <View style={styles.empty}>
                <Ionicons name="git-merge" size={40} color={colors.accent} />
                <Text variant="body" color="textMuted" style={styles.emptyText}>
                  Pick two titles you love to see the anime they both point to.
                </Text>
              </View>
            ) : isLoading ? (
              <View style={styles.empty}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : (
              <View style={styles.empty}>
                <Text variant="body" color="textMuted" style={styles.emptyText}>
                  No common ground between these two. Try a different pair.
                </Text>
              </View>
            )
          }
        />
      )}
    </Screen>
  );
}

function SlotButton({
  slot,
  label,
  onPress,
  colors,
}: {
  slot: Slot;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.slot, { backgroundColor: colors.surface, borderColor: slot ? colors.accent : colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={slot ? `${label}: ${slot.title}` : `Choose ${label}`}
    >
      {slot ? (
        <>
          <Image
            source={slot.coverImage ?? undefined}
            style={styles.slotPoster}
            contentFit="cover"
          />
          <Text variant="caption" numberOfLines={1} style={styles.slotTitle}>
            {slot.title}
          </Text>
        </>
      ) : (
        <>
          <Ionicons name="add-circle-outline" size={26} color={colors.textMuted} />
          <Text variant="caption" color="textMuted">
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: H_PADDING,
    paddingTop: spacing.md,
    gap: spacing.xl,
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
  slots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  slot: {
    flex: 1,
    height: 96,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
  },
  slotPoster: {
    width: 44,
    height: 60,
    borderRadius: radii.sm,
  },
  slotTitle: {
    textAlign: 'center',
  },
  pickerContent: {
    paddingHorizontal: H_PADDING,
    paddingTop: spacing.xl,
    paddingBottom: BOTTOM_SPACE,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickPoster: {
    width: 40,
    height: 56,
    borderRadius: radii.sm,
  },
  pickTitle: {
    flex: 1,
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
  empty: {
    alignItems: 'center',
    marginTop: spacing['4xl'],
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    textAlign: 'center',
  },
});
