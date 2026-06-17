import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Screen } from '../src/components/ui/Screen';
import { Text } from '../src/components/ui/Text';
import { Skeleton } from '../src/components/ui/Skeleton';
import { MatchCard } from '../src/components/MatchCard';
import { useForYou, type ForYouItem } from '../src/features/recommendations/hooks';
import { useDismissedStore } from '../src/features/recommendations/store';
import { radii, spacing, useTheme } from '../src/theme';

const H_PADDING = spacing.xl;
const BOTTOM_SPACE = 110;

export default function ForYouScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { items, isLoading, isError } = useForYou();
  const dismiss = useDismissedStore((s) => s.dismiss);

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
          <View style={styles.titleBlock}>
            <Text variant="display">For You</Text>
            <Text variant="caption" color="textMuted">
              Picked from what you love
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/swipe')}
            style={[styles.swipeBtn, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Swipe through picks"
          >
            <Ionicons name="layers" size={16} color={colors.onMedia} />
            <Text variant="caption" color={colors.onMedia}>
              Swipe
            </Text>
          </Pressable>
        </View>

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => router.push('/roulette')}
            style={[styles.modeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Surprise me"
          >
            <Ionicons name="dice" size={16} color={colors.accent} />
            <Text variant="caption" color="text">
              Surprise me
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/blend')}
            style={[styles.modeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Blend two titles"
          >
            <Ionicons name="git-merge" size={16} color={colors.accent} />
            <Text variant="caption" color="text">
              Blend
            </Text>
          </Pressable>
        </View>
      </View>

      <Animated.FlatList
        data={items}
        keyExtractor={(item: ForYouItem) => String(item.media.id)}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item }: { item: ForYouItem }) => (
          <Animated.View entering={FadeIn.duration(250)}>
            <MatchCard item={item} onDismiss={() => dismiss(item.media.id)} />
          </Animated.View>
        )}
        ListFooterComponent={
          isLoading && items.length > 0 ? (
            <ActivityIndicator color={colors.accent} style={styles.footer} />
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <MatchListSkeleton />
          ) : (
            <View style={styles.empty}>
              <Text variant="heading" style={styles.emptyTitle}>
                {isError ? 'Couldn’t load picks' : 'Not enough to go on yet'}
              </Text>
              <Text variant="body" color="textMuted" style={styles.emptyBody}>
                {isError
                  ? 'Check your connection and try again.'
                  : 'Mark a few anime as Watching or Completed — and rate the ones you love — and your recommendations will appear here.'}
              </Text>
            </View>
          )
        }
      />
    </Screen>
  );
}

function MatchListSkeleton() {
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={72} height={108} radius={12} />
          <View style={styles.skeletonBody}>
            <Skeleton width={64} height={22} radius={6} />
            <Skeleton width={180} height={14} radius={6} />
            <Skeleton width={140} height={12} radius={6} />
          </View>
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
  titleBlock: {
    flex: 1,
  },
  swipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: H_PADDING,
    paddingTop: spacing.xl,
    paddingBottom: BOTTOM_SPACE,
  },
  footer: {
    marginTop: spacing.lg,
  },
  empty: {
    alignItems: 'center',
    marginTop: spacing['4xl'],
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
  },
  skeletonList: {
    gap: spacing.md,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  skeletonBody: {
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
  },
});
