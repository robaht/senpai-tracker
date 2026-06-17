import { useState } from 'react';
import { View, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  Extrapolation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { radii, spacing, useTheme } from '../theme';
import { Text } from './ui/Text';
import { withAlpha } from './ui/Badge';
import { displayTitle } from '../api/anilist';
import type { ForYouItem } from '../features/recommendations/hooks';

interface SwipeDeckProps {
  items: ForYouItem[];
  /** Swiped right — add to Plan to Watch. */
  onLike: (item: ForYouItem) => void;
  /** Swiped left — not interested. */
  onNope: (item: ForYouItem) => void;
}

/**
 * A Tinder-style recommendation deck. The top card follows the drag (with a
 * little rotation); past a threshold it flies off — right adds to Plan to Watch,
 * left marks not interested — and the next card rises into place. Tap the action
 * buttons for the same effect without dragging.
 */
export function SwipeDeck({ items, onLike, onNope }: SwipeDeckProps) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);

  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const cardW = width - spacing.xl * 2;
  const threshold = width * 0.25;

  const current = items[index];
  const next = items[index + 1];

  // Runs on the JS thread after a card flies off: record the choice, advance,
  // and recenter the shared values for the incoming card.
  const commit = (dir: 1 | -1) => {
    const item = items[index];
    if (item) (dir === 1 ? onLike : onNope)(item);
    x.value = 0;
    y.value = 0;
    setIndex((i) => i + 1);
  };

  const flyOff = (dir: 1 | -1) => {
    'worklet';
    x.value = withTiming(dir * width * 1.5, { duration: 260 }, (finished) => {
      if (finished) runOnJS(commit)(dir);
    });
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      x.value = e.translationX;
      y.value = e.translationY;
    })
    .onEnd((e) => {
      const past = Math.abs(e.translationX) > threshold || Math.abs(e.velocityX) > 800;
      if (past) {
        flyOff(e.translationX > 0 ? 1 : -1);
      } else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
    });

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotateZ: `${interpolate(x.value, [-width, 0, width], [-9, 0, 9], Extrapolation.CLAMP)}deg` },
    ],
  }));

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, threshold], [0, 1], Extrapolation.CLAMP),
  }));
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-threshold, 0], [1, 0], Extrapolation.CLAMP),
  }));

  // The card behind grows toward full size as the top card is dragged away.
  const behindStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(Math.abs(x.value), [0, threshold], [0.94, 1], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(Math.abs(x.value), [0, threshold], [0.6, 1], Extrapolation.CLAMP),
  }));

  if (!current) {
    return (
      <View style={styles.empty}>
        <Ionicons name="checkmark-done-circle" size={48} color={colors.accent} />
        <Text variant="heading" style={styles.emptyTitle}>
          You’re all caught up
        </Text>
        <Text variant="body" color="textMuted" style={styles.emptyBody}>
          That’s every pick for now. Come back after you’ve watched a few more.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.deck, { width: cardW }]}>
        {next && (
          <Animated.View style={[styles.cardSlot, behindStyle]} pointerEvents="none">
            <DeckCard item={next} colors={colors} />
          </Animated.View>
        )}

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.cardSlot, topStyle]}>
            <DeckCard item={current} colors={colors}>
              <Animated.View style={[styles.stamp, styles.stampLike, likeStyle]}>
                <Text variant="heading" color={colors.positive}>
                  ADD
                </Text>
              </Animated.View>
              <Animated.View style={[styles.stamp, styles.stampNope, nopeStyle]}>
                <Text variant="heading" color={colors.danger}>
                  NOPE
                </Text>
              </Animated.View>
            </DeckCard>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => flyOff(-1)}
          style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Not interested"
        >
          <Ionicons name="close" size={28} color={colors.danger} />
        </Pressable>
        <Pressable
          onPress={() => flyOff(1)}
          style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Add to Plan to Watch"
        >
          <Ionicons name="add" size={30} color={colors.positive} />
        </Pressable>
      </View>
    </View>
  );
}

function DeckCard({
  item,
  colors,
  children,
}: {
  item: ForYouItem;
  colors: ReturnType<typeof useTheme>['colors'];
  children?: React.ReactNode;
}) {
  const { media, match, reasons, becauseOf } = item;
  const uri = media.coverImage?.extraLarge ?? media.coverImage?.large ?? undefined;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: media.coverImage?.color ?? colors.surfaceElevated, borderColor: colors.border },
      ]}
    >
      <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.92)']}
        locations={[0.35, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      {match !== null && (
        <View style={[styles.matchPill, { backgroundColor: withAlpha(colors.accent, 0.92) }]}>
          <Text variant="callout" color={colors.onMedia}>
            {match}% match
          </Text>
        </View>
      )}

      <View style={styles.cardBody}>
        <Text variant="title" color="#fff" numberOfLines={2}>
          {displayTitle(media.title)}
        </Text>
        <Text variant="caption" color="rgba(255,255,255,0.82)" numberOfLines={1}>
          Because you watched {becauseOf}
        </Text>
        {reasons.length > 0 && (
          <View style={styles.chips}>
            {reasons.map((g) => (
              <View key={g} style={styles.chip}>
                <Text variant="caption" color="#fff">
                  {g}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2xl'],
  },
  deck: {
    aspectRatio: 0.7,
    maxHeight: '78%',
  },
  cardSlot: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    flex: 1,
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'flex-end',
  },
  matchPill: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  cardBody: {
    padding: spacing.xl,
    gap: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  stamp: {
    position: 'absolute',
    top: spacing.xl,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 3,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  stampLike: {
    right: spacing.md,
    borderColor: '#39D98A',
    transform: [{ rotateZ: '12deg' }],
  },
  stampNope: {
    left: spacing.md,
    borderColor: '#FF5C5C',
    transform: [{ rotateZ: '-12deg' }],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  actionBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.md,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
  },
});
