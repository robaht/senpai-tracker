import { useRef } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../src/components/ui/Screen';
import { Text } from '../src/components/ui/Text';
import { SwipeDeck } from '../src/components/SwipeDeck';
import { useForYou, type ForYouItem } from '../src/features/recommendations/hooks';
import { useDismissedStore } from '../src/features/recommendations/store';
import { useTrackingStore } from '../src/features/tracking/store';
import { spacing, useTheme } from '../src/theme';

export default function SwipeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { items, isLoading } = useForYou();
  const track = useTrackingStore((s) => s.track);
  const dismiss = useDismissedStore((s) => s.dismiss);

  // Freeze the deck to the first loaded batch — liking/noping persists to the
  // stores (and reshapes future For You results) without reshuffling the deck
  // out from under the current swipe session.
  const deck = useRef<ForYouItem[] | null>(null);
  if (!deck.current && items.length > 0) deck.current = items;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: colors.surface }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View>
          <Text variant="display">Swipe</Text>
          <Text variant="caption" color="textMuted">
            Right to add · left to skip
          </Text>
        </View>
      </View>

      {deck.current ? (
        <SwipeDeck
          items={deck.current}
          onLike={(item) => track(item.media, 'PLANNING')}
          onNope={(item) => dismiss(item.media.id)}
        />
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <View style={styles.center}>
          <Text variant="heading" style={styles.emptyTitle}>
            Nothing to swipe yet
          </Text>
          <Text variant="body" color="textMuted" style={styles.emptyBody}>
            Mark a few anime as Watching or Completed first, then come back.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.sm,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
  },
});
