import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Screen } from '../src/components/ui/Screen';
import { Text } from '../src/components/ui/Text';
import { useForYou, type ForYouItem } from '../src/features/recommendations/hooks';
import { displayTitle, type MediaFormat } from '../src/api/anilist';
import { radii, spacing, useTheme } from '../src/theme';

type LengthFilter = 'ANY' | 'MOVIE' | 'SERIES';

const FILTERS: { key: LengthFilter; label: string }[] = [
  { key: 'ANY', label: 'Anything' },
  { key: 'MOVIE', label: 'Movies' },
  { key: 'SERIES', label: 'Series' },
];

const SERIES_FORMATS: MediaFormat[] = ['TV', 'TV_SHORT', 'ONA'];

function matchesFilter(item: ForYouItem, filter: LengthFilter): boolean {
  const fmt = item.media.format;
  if (filter === 'MOVIE') return fmt === 'MOVIE';
  if (filter === 'SERIES') return fmt !== null && SERIES_FORMATS.includes(fmt);
  return true;
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export default function RouletteScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { colors, gradients } = useTheme();
  const { items } = useForYou();

  const [filter, setFilter] = useState<LengthFilter>('ANY');
  const [shown, setShown] = useState<ForYouItem | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const pool = items.filter((i) => matchesFilter(i, filter));

  // Seed a first pick (and re-seed when the filter empties the current one).
  useEffect(() => {
    if (spinning) return;
    if (pool.length > 0 && (!shown || !matchesFilter(shown, filter))) {
      setShown(pick(pool));
    } else if (pool.length === 0) {
      setShown(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, items.length]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const spin = () => {
    if (pool.length === 0 || spinning) return;
    setSpinning(true);
    const start = Date.now();
    let delay = 55;
    const tick = () => {
      setShown(pick(pool));
      delay *= 1.14; // decelerate
      if (Date.now() - start < 1500) {
        timer.current = setTimeout(tick, delay);
      } else {
        setSpinning(false);
        pop.value = withSequence(
          withTiming(1.07, { duration: 130 }),
          withTiming(1, { duration: 180 }),
        );
      }
    };
    tick();
  };

  const cardW = Math.min(300, width - spacing.xl * 2);

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
          <Text variant="display">Surprise Me</Text>
          <Text variant="caption" color="textMuted">
            Can’t decide? Spin for tonight’s pick
          </Text>
        </View>
      </View>

      <View style={styles.segment}>
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.segmentItem, { backgroundColor: active ? colors.accent : colors.surface }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text variant="caption" color={active ? colors.onMedia : 'textMuted'}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.stage}>
        {shown ? (
          <Animated.View style={popStyle}>
            <Pressable
              onPress={() => !spinning && router.push(`/anime/${shown.media.id}`)}
              disabled={spinning}
              accessibilityRole="button"
              accessibilityLabel={displayTitle(shown.media.title)}
            >
              <View
                style={[
                  styles.card,
                  {
                    width: cardW,
                    backgroundColor: shown.media.coverImage?.color ?? colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Image
                  source={shown.media.coverImage?.extraLarge ?? shown.media.coverImage?.large ?? undefined}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={spinning ? 0 : 200}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.92)']}
                  locations={[0.4, 0.7, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.cardBody}>
                  <Text variant="heading" color="#fff" numberOfLines={2}>
                    {displayTitle(shown.media.title)}
                  </Text>
                  {!spinning && shown.match !== null && (
                    <Text variant="caption" color="rgba(255,255,255,0.82)">
                      {shown.match}% match · because you watched {shown.becauseOf}
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          </Animated.View>
        ) : (
          <View style={[styles.card, styles.cardEmpty, { width: cardW, borderColor: colors.border }]}>
            <Text variant="callout" color="textMuted" style={styles.emptyText}>
              No {filter === 'ANY' ? 'recommendations' : FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} to spin yet. Track and rate a few more anime.
            </Text>
          </View>
        )}
      </View>

      <Pressable onPress={spin} disabled={pool.length === 0 || spinning} style={styles.spinWrap}>
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.spinBtn, (pool.length === 0 || spinning) && styles.spinDisabled]}
        >
          <Ionicons name="dice" size={22} color={colors.onMedia} />
          <Text variant="callout" color={colors.onMedia}>
            {spinning ? 'Spinning…' : 'Spin'}
          </Text>
        </LinearGradient>
      </Pressable>
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
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    aspectRatio: 0.7,
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'flex-end',
  },
  cardEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    textAlign: 'center',
  },
  cardBody: {
    padding: spacing.xl,
    gap: spacing.xs,
  },
  spinWrap: {
    alignSelf: 'center',
    marginBottom: spacing['2xl'],
  },
  spinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['3xl'],
    borderRadius: radii.pill,
  },
  spinDisabled: {
    opacity: 0.5,
  },
});
