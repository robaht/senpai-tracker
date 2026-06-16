import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../src/components/ui/Screen';
import { Text } from '../src/components/ui/Text';
import { PressableScale } from '../src/components/ui/PressableScale';
import { useComfortStore } from '../src/features/comfort/store';
import type { ComfortPick } from '../src/features/comfort/types';
import { radii, spacing } from '../src/theme';

/**
 * The Comfort Corner runs its own warm, dim, candle-lit palette regardless of the
 * active app theme — the whole point is that it feels like a different, cozier
 * room. Espresso backdrop, an amber "lamp" glow pooling from the top, sunset-ember
 * accents and cream text.
 */
const COZY = {
  bgTop: '#211710',
  bgBottom: '#0E0905',
  lamp: 'rgba(255,168,87,0.32)',
  lampSoft: 'rgba(255,110,88,0.06)',
  ember: ['#FFA45C', '#EA6E85'] as const,
  emberInk: '#2E1606',
  card: 'rgba(255,188,124,0.07)',
  cardBorder: 'rgba(255,188,124,0.16)',
  cream: '#F5E8DA',
  creamMuted: '#CBB6A2',
  creamFaint: '#9C8979',
  amber: '#FFBE7B',
  control: 'rgba(255,236,214,0.08)',
};

export default function ComfortScreen() {
  const router = useRouter();
  const picks = useComfortStore((s) => s.picks);
  const remove = useComfortStore((s) => s.remove);

  const surprise = () => {
    if (picks.length === 0) return;
    const pick = picks[Math.floor(Math.random() * picks.length)];
    router.push(`/anime/${pick.mediaId}`);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Layered warm lighting: espresso base, an amber lamp pooling from the top,
          and a soft vignette so the corners fall into dim. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient colors={[COZY.bgTop, COZY.bgBottom]} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={[COZY.lamp, COZY.lampSoft, 'transparent']}
          style={styles.lamp}
        />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.45)']} style={styles.vignette} />
      </View>

      <Screen style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={COZY.cream} />
          </Pressable>
          <View>
            <Text variant="overline" color={COZY.amber}>
              {picks.length} {picks.length === 1 ? 'PICK' : 'PICKS'}
            </Text>
            <Text variant="display" color={COZY.cream}>
              Comfort Corner
            </Text>
          </View>
        </View>

        {picks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🍵</Text>
            <Text variant="subheading" align="center" color={COZY.cream}>
              Your comfort corner is empty
            </Text>
            <Text variant="body" align="center" color={COZY.creamFaint} style={styles.emptySub}>
              The shows you always come back to live here. Open a title and tap “Add to
              Comfort” to start your shelf.
            </Text>
          </View>
        ) : (
          <FlatList
            data={picks}
            keyExtractor={(p) => String(p.mediaId)}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <PressableScale
                onPress={surprise}
                style={styles.heroWrap}
                accessibilityRole="button"
                accessibilityLabel="Pick something to watch at random"
              >
                <LinearGradient
                  colors={COZY.ember}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.hero}
                >
                  <View style={styles.heroIcon}>
                    <Ionicons name="shuffle" size={22} color={COZY.emberInk} />
                  </View>
                  <View style={styles.heroText}>
                    <Text variant="subheading" color={COZY.emberInk}>
                      What should I watch?
                    </Text>
                    <Text variant="caption" color="rgba(46,22,6,0.72)">
                      Surprise me with one of my comfort shows
                    </Text>
                  </View>
                </LinearGradient>
              </PressableScale>
            }
            renderItem={({ item }) => (
              <ComfortCard
                pick={item}
                onOpen={() => router.push(`/anime/${item.mediaId}`)}
                onRemove={() => remove(item.mediaId)}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.gap} />}
          />
        )}
      </Screen>
    </View>
  );
}

/** A warm shelf card: large cover, title, and a remove control. */
function ComfortCard({
  pick,
  onOpen,
  onRemove,
}: {
  pick: ComfortPick;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <PressableScale activeScale={0.98} onPress={onOpen} style={styles.card}>
      <View style={[styles.cover, { backgroundColor: pick.coverColor ?? '#2A1C12' }]}>
        <Image source={pick.coverImage ?? undefined} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      </View>
      <View style={styles.cardBody}>
        <Text variant="subheading" numberOfLines={2} color={COZY.cream}>
          {pick.title}
        </Text>
        <View style={styles.tag}>
          <Ionicons name="cafe" size={13} color={COZY.amber} />
          <Text variant="caption" color={COZY.creamFaint}>
            On your shelf
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        style={styles.removeBtn}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${pick.title} from Comfort Corner`}
      >
        <Ionicons name="close" size={18} color={COZY.creamMuted} />
      </Pressable>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COZY.bgBottom },
  screen: { backgroundColor: 'transparent' },
  lamp: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 480,
  },
  vignette: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COZY.control,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing['5xl'],
  },
  heroWrap: {
    marginBottom: spacing.xl,
    borderRadius: radii.lg,
    // Warm glow under the hero — the lamp catching the card.
    shadowColor: '#FF8A4C',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,246,238,0.28)',
  },
  heroText: { flex: 1, gap: 2 },
  gap: { height: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COZY.cardBorder,
    backgroundColor: COZY.card,
  },
  cover: {
    width: 60,
    height: 84,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  cardBody: { flex: 1, gap: 6 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COZY.control,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['5xl'],
    gap: spacing.sm,
  },
  emptyEmoji: { fontSize: 44, marginBottom: spacing.sm },
  emptySub: { maxWidth: 300, marginTop: 2 },
});
