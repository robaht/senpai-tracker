import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../src/components/ui/Text';
import { EmptyState } from '../src/components/EmptyState';
import { Screen } from '../src/components/ui/Screen';
import {
  useWrapped,
  useWrappedYears,
  type WrappedSummary,
  type WrappedTitle,
} from '../src/features/stats/wrapped';
import { STATUS_META, type WatchStatus } from '../src/features/tracking/types';
import { useOpeningTheme } from '../src/features/wrapped/openingTheme';
import { shareWrapped, type ShareResult } from '../src/features/wrapped/shareCard';
import { gradientFromCover, type Palette } from '../src/features/wrapped/colors';
import { WrappedShareCard } from '../src/features/wrapped/WrappedShareCard';
import { radii, spacing } from '../src/theme';

const CARD_MS = 6000;

/**
 * Bold, theme-independent gradient set for the story. Wrapped is a "moment" —
 * it reads as its own vivid world rather than the app chrome, and exports look
 * intentional regardless of the active theme. White foreground throughout
 * (on-media style), so every pairing stays legible.
 */
const PALETTES: Palette[] = [
  { from: '#1A1036', to: '#7C5CFF', accent: '#FFC24B' }, // violet
  { from: '#08203E', to: '#557C93', accent: '#38E0FF' }, // deep blue
  { from: '#3A1C71', to: '#FF6FA5', accent: '#FFE66D' }, // plum→pink
  { from: '#0F2027', to: '#2C9A7E', accent: '#9CFFCB' }, // teal
  { from: '#42124E', to: '#C04DFF', accent: '#FF9DC1' }, // magenta
  { from: '#1F1B2E', to: '#FF5C6E', accent: '#FFD36E' }, // ember
  { from: '#10203A', to: '#4DA6FF', accent: '#7CFFE0' }, // azure
];

type CardKind =
  | 'intro'
  | 'covers'
  | 'episodes'
  | 'hours'
  | 'completed'
  | 'genres'
  | 'topRated'
  | 'binged'
  | 'month'
  | 'archetype'
  | 'finale';

/** Card palette — title cards borrow their show's real cover color. */
function paletteFor(kind: CardKind, index: number, s: WrappedSummary): Palette {
  const fallback = PALETTES[index % PALETTES.length];
  if (kind === 'topRated') return gradientFromCover(s.topRated?.coverColor ?? null, fallback);
  if (kind === 'binged') return gradientFromCover(s.mostBinged?.coverColor ?? null, fallback);
  if (kind === 'finale') return gradientFromCover((s.topRated ?? s.mostBinged)?.coverColor ?? null, fallback);
  return fallback;
}

export default function WrappedScreen() {
  const router = useRouter();
  const years = useWrappedYears();
  const year = years[0] ?? new Date().getFullYear();
  const summary = useWrapped(year);

  // Soundtrack = the top anime's opening theme (music, no voice lines; web only).
  const topTitle = summary.topRated?.title ?? summary.mostBinged?.title ?? null;
  const sound = useOpeningTheme(topTitle);
  const insets = useSafeAreaInsets();

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => active && setReduceMotion(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  // Which cards have enough data to show.
  const cards = useMemo<CardKind[]>(() => buildCards(summary), [summary]);

  // The finale's cover-tinted palette also styles the off-screen native share card.
  const finalePalette = paletteFor('finale', cards.length - 1, summary);
  const shareRef = useRef<View>(null);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const progress = useSharedValue(0);

  const close = useCallback(() => {
    // Deep-linked opens have no back stack; fall back to the stats screen.
    if (router.canGoBack()) router.back();
    else router.replace('/stats');
  }, [router]);

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i >= cards.length - 1) {
        close();
        return i;
      }
      return i + 1;
    });
  }, [cards, close]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? 0 : i - 1));
  }, []);

  // RAF-driven auto-advance + progress fill (pausable, unlike a withTiming timer).
  useEffect(() => {
    progress.value = 0;
    if (cards.length === 0) return;
    // The finale rests — it holds the share action, so it never auto-advances.
    if (index >= cards.length - 1) {
      progress.value = 1;
      return;
    }
    let raf = 0;
    let last = 0;
    const tick = (ts: number) => {
      if (last === 0) last = ts;
      const dt = ts - last;
      last = ts;
      if (!paused) {
        const next = progress.value + dt / CARD_MS;
        if (next >= 1) {
          progress.value = 1;
          goNext();
          return;
        }
        progress.value = next;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, paused, cards.length, goNext, progress]);

  if (summary.titles === 0) {
    return (
      <Screen>
        <View style={styles.emptyHeader}>
          <CloseButton onPress={close} />
        </View>
        <EmptyState
          emoji="🎴"
          title="No Wrapped yet"
          subtitle="Track and rate a few shows this year, then come back to relive your anime journey."
        />
      </Screen>
    );
  }

  const kind = cards[index];
  const palette = paletteFor(kind, index, summary);

  // Press-and-hold pauses; a quick tap navigates (left third = back, else next).
  const pressStart = useRef(0);
  const onZoneIn = () => {
    pressStart.current = Date.now();
    setPaused(true);
  };
  const isFinale = kind === 'finale';
  const onZoneOut = (dir: 'prev' | 'next') => {
    const held = Date.now() - pressStart.current;
    setPaused(false);
    // On the finale a tap never advances/closes (use the Close button); tapping
    // back is still allowed so the story stays navigable.
    if (held >= 220) return;
    if (dir === 'next' && isFinale) return;
    (dir === 'next' ? goNext : goPrev)();
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        key={kind}
        colors={[palette.from, palette.to]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Off-screen card captured for the native share (real covers included). */}
      {Platform.OS !== 'web' && (
        <View style={styles.captureHost} pointerEvents="none">
          <WrappedShareCard ref={shareRef} summary={summary} palette={finalePalette} />
        </View>
      )}

      {/* Tap zones */}
      <Pressable
        style={[styles.zone, styles.zoneLeft]}
        onPressIn={onZoneIn}
        onPressOut={() => onZoneOut('prev')}
        accessibilityLabel="Previous"
      />
      <Pressable
        style={[styles.zone, styles.zoneRight]}
        onPressIn={onZoneIn}
        onPressOut={() => onZoneOut('next')}
        accessibilityLabel="Next"
      />

      {/* Card content (keyed so each remounts → fresh entrance + count-up).
          Non-finale cards are non-interactive so a tap anywhere falls through to
          the zones and advances; the finale absorbs background taps (so it never
          accidentally closes) while keeping its Share button live. */}
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 76, paddingBottom: insets.bottom + 40 },
          { pointerEvents: isFinale ? 'box-none' : 'none' },
        ]}
      >
        <CardBody
          key={`${index}-${kind}`}
          kind={kind}
          summary={summary}
          palette={palette}
          reduceMotion={reduceMotion}
          onShare={() => shareWrapped(summary, palette, shareRef)}
        />
      </View>

      {/* Top chrome: progress segments + controls */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm, pointerEvents: 'box-none' }]}>
        <View style={styles.segments}>
          {cards.map((_, i) => (
            <Segment key={i} state={i < index ? 'done' : i === index ? 'active' : 'todo'} progress={progress} />
          ))}
        </View>
        <View style={[styles.controlsRow, { pointerEvents: 'box-none' }]}>
          <View style={styles.brandCol}>
            <Text variant="overline" style={styles.brand}>
              {summary.year} · SENPAI WRAPPED
            </Text>
            {sound.available && sound.enabled && sound.nowPlaying && (
              <Text variant="caption" style={styles.nowPlaying} numberOfLines={1}>
                ♪ {sound.nowPlaying}
              </Text>
            )}
          </View>
          <View style={styles.controlsRight}>
            {sound.available && (
              <RoundButton
                icon={sound.enabled ? 'volume-high' : 'volume-mute'}
                onPress={sound.toggle}
                label={sound.enabled ? 'Mute opening theme' : 'Play opening theme'}
              />
            )}
            <CloseButton onPress={close} />
          </View>
        </View>
      </View>
    </View>
  );
}

/** One progress segment; the active one fills with the shared `progress` value. */
function Segment({
  state,
  progress,
}: {
  state: 'done' | 'active' | 'todo';
  progress: SharedValue<number>;
}) {
  const fill = useAnimatedStyle(() => ({
    width: state === 'done' ? '100%' : state === 'active' ? `${progress.value * 100}%` : '0%',
  }));
  return (
    <View style={styles.segTrack}>
      <Animated.View style={[styles.segFill, fill]} />
    </View>
  );
}

function buildCards(s: WrappedSummary): CardKind[] {
  const cards: CardKind[] = ['intro', 'episodes', 'hours', 'completed'];
  if (s.topGenres.length > 0) cards.push('genres');
  if (s.topRated) cards.push('topRated');
  if (s.mostBinged && s.mostBinged.mediaId !== s.topRated?.mediaId) cards.push('binged');
  if (s.busiestMonth) cards.push('month');
  if (s.covers.length >= 4) cards.push('covers');
  cards.push('archetype', 'finale');
  return cards;
}

// ---------------------------------------------------------------------------
// Card bodies
// ---------------------------------------------------------------------------

function CardBody({
  kind,
  summary: s,
  palette,
  reduceMotion,
  onShare,
}: {
  kind: CardKind;
  summary: WrappedSummary;
  palette: { from: string; to: string; accent: string };
  reduceMotion: boolean;
  onShare: () => Promise<ShareResult>;
}) {
  switch (kind) {
    case 'intro':
      return (
        <Reveal reduceMotion={reduceMotion}>
          {s.covers.length > 0 && <PosterFan covers={s.covers} reduceMotion={reduceMotion} />}
          <Text style={styles.kicker}>Let's rewind</Text>
          <Big>Your {s.year}{'\n'}in anime</Big>
          <Lead>You tracked {s.titles} {s.titles === 1 ? 'title' : 'titles'} this year. Here's how it went →</Lead>
        </Reveal>
      );
    case 'covers':
      return <CoversMosaic covers={s.covers} reduceMotion={reduceMotion} />;
    case 'episodes':
      return (
        <Reveal reduceMotion={reduceMotion}>
          <Text style={styles.kicker}>You watched</Text>
          <CountUp value={s.episodes} accent={palette.accent} reduceMotion={reduceMotion} />
          <Big>episodes</Big>
          <Lead>{episodesQuip(s.episodes)}</Lead>
        </Reveal>
      );
    case 'hours': {
      const days = Math.round((s.hours / 24) * 10) / 10;
      return (
        <Reveal reduceMotion={reduceMotion}>
          <Text style={styles.kicker}>That's about</Text>
          <CountUp value={s.hours} accent={palette.accent} reduceMotion={reduceMotion} />
          <Big>hours{s.hoursEstimated ? ' ≈' : ''}</Big>
          <Lead>Roughly {days} full {days === 1 ? 'day' : 'days'} of pure anime. Worth it.</Lead>
        </Reveal>
      );
    }
    case 'completed':
      return (
        <Reveal reduceMotion={reduceMotion}>
          <Text style={styles.kicker}>You finished</Text>
          <CountUp value={s.completed} accent={palette.accent} reduceMotion={reduceMotion} />
          <Big>{s.completed === 1 ? 'series' : 'series'}</Big>
          <View style={styles.chipWrap}>
            {s.statusBreakdown.map((st) => (
              <View key={st.key} style={styles.statusChip}>
                <Text variant="caption" style={styles.onMediaMuted}>
                  {STATUS_META[st.key as WatchStatus].short} · {st.count}
                </Text>
              </View>
            ))}
          </View>
        </Reveal>
      );
    case 'genres':
      return (
        <Reveal reduceMotion={reduceMotion}>
          <Text style={styles.kicker}>Your top genres</Text>
          <View style={styles.genreList}>
            {s.topGenres.map((g, i) => {
              const max = s.topGenres[0].count;
              return (
                <View key={g.key} style={styles.genreRow}>
                  <Text style={styles.genreRank}>{i + 1}</Text>
                  <View style={styles.genreBarWrap}>
                    <Text style={styles.genreName}>{g.key}</Text>
                    <View style={styles.genreTrack}>
                      <View
                        style={[
                          styles.genreFill,
                          { width: `${Math.max(12, (g.count / max) * 100)}%`, backgroundColor: palette.accent },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={styles.genreCount}>{g.count}</Text>
                </View>
              );
            })}
          </View>
        </Reveal>
      );
    case 'topRated':
      return (
        <PosterCardBody
          reduceMotion={reduceMotion}
          kicker="Your favorite"
          title={s.topRated!.title}
          cover={s.topRated!.coverImage}
          badge={`★ ${s.topRated!.value}`}
          accent={palette.accent}
          caption="Your highest-rated watch of the year."
        />
      );
    case 'binged':
      return (
        <PosterCardBody
          reduceMotion={reduceMotion}
          kicker="Most binged"
          title={s.mostBinged!.title}
          cover={s.mostBinged!.coverImage}
          badge={`${s.mostBinged!.value} eps`}
          accent={palette.accent}
          caption="The one you couldn't stop watching."
        />
      );
    case 'month':
      return (
        <Reveal reduceMotion={reduceMotion}>
          <Text style={styles.kicker}>Your busiest stretch</Text>
          <Big>{s.busiestMonth!.label}</Big>
          <Lead>
            You added {s.busiestMonth!.count} {s.busiestMonth!.count === 1 ? 'title' : 'titles'} that month — your
            biggest anime mood of {s.year}.
          </Lead>
        </Reveal>
      );
    case 'archetype':
      return (
        <Reveal reduceMotion={reduceMotion}>
          <Text style={styles.emoji}>{s.archetype.emoji}</Text>
          <Text style={styles.kicker}>This year, you were</Text>
          <Big>{s.archetype.name}</Big>
          <Lead>{s.archetype.blurb}</Lead>
        </Reveal>
      );
    case 'finale':
      return (
        <FinaleBody summary={s} palette={palette} reduceMotion={reduceMotion} onShare={onShare} />
      );
  }
}

/** A small fanned stack of your top covers — a peek of the year up top. */
function PosterFan({ covers, reduceMotion }: { covers: WrappedTitle[]; reduceMotion: boolean }) {
  const shown = covers.slice(0, 5);
  return (
    <View style={styles.fan}>
      {shown.map((c, i) => {
        const mid = (shown.length - 1) / 2;
        const rotate = `${(i - mid) * 9}deg`;
        return (
          <Animated.View
            key={c.mediaId}
            entering={reduceMotion ? undefined : FadeIn.delay(i * 80).duration(420)}
            style={[
              styles.fanItem,
              { marginLeft: i === 0 ? 0 : -28, transform: [{ rotate }, { translateY: Math.abs(i - mid) * 6 }] },
            ]}
          >
            {c.coverImage ? (
              <Image source={{ uri: c.coverImage }} style={styles.fanPoster} contentFit="cover" transition={150} />
            ) : (
              <View style={[styles.fanPoster, styles.posterFallback]} />
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

/** A wall of every cover you watched — "your year, one grid". */
function CoversMosaic({ covers, reduceMotion }: { covers: WrappedTitle[]; reduceMotion: boolean }) {
  const shown = covers.slice(0, 24);
  return (
    <View style={styles.mosaicWrap}>
      <Text style={styles.kicker}>Your year in covers</Text>
      <Big>{covers.length} {covers.length === 1 ? 'title' : 'titles'}, one wall</Big>
      <View style={styles.mosaic}>
        {shown.map((c, i) => (
          <Animated.View
            key={c.mediaId}
            entering={reduceMotion ? undefined : FadeIn.delay(Math.min(i * 45, 900)).duration(360)}
            style={styles.mosaicCell}
          >
            {c.coverImage ? (
              <Image source={{ uri: c.coverImage }} style={styles.mosaicPoster} contentFit="cover" transition={120} />
            ) : (
              <View style={[styles.mosaicPoster, styles.posterFallback]} />
            )}
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function PosterCardBody({
  reduceMotion,
  kicker,
  title,
  cover,
  badge,
  accent,
  caption,
}: {
  reduceMotion: boolean;
  kicker: string;
  title: string;
  cover: string | null;
  badge: string;
  accent: string;
  caption: string;
}) {
  return (
    <Reveal reduceMotion={reduceMotion}>
      <Text style={styles.kicker}>{kicker}</Text>
      <View style={styles.posterWrap}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.poster} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.poster, styles.posterFallback]}>
            <Ionicons name="film-outline" size={48} color="rgba(255,255,255,0.6)" />
          </View>
        )}
        <View style={[styles.posterBadge, { backgroundColor: accent }]}>
          <Text variant="callout" style={styles.posterBadgeText}>
            {badge}
          </Text>
        </View>
      </View>
      <Text variant="title" style={styles.posterTitle} numberOfLines={3}>
        {title}
      </Text>
      <Lead>{caption}</Lead>
    </Reveal>
  );
}

function FinaleBody({
  summary: s,
  palette,
  reduceMotion,
  onShare,
}: {
  summary: WrappedSummary;
  palette: { from: string; to: string; accent: string };
  reduceMotion: boolean;
  onShare: () => Promise<ShareResult>;
}) {
  const [status, setStatus] = useState<'idle' | 'working' | ShareResult>('idle');
  const onPress = async () => {
    setStatus('working');
    setStatus(await onShare());
  };
  const recap: Array<[string, string]> = [
    [String(s.episodes), 'episodes'],
    [String(s.hours), 'hours'],
    [String(s.completed), 'completed'],
    [s.topGenres[0]?.key ?? '—', 'top genre'],
  ];
  return (
    <Reveal reduceMotion={reduceMotion}>
      <Text style={styles.emoji}>{s.archetype.emoji}</Text>
      <Big>{s.year} Wrapped</Big>
      {s.covers.length > 0 && (
        <View style={styles.finaleCovers}>
          {s.covers.slice(0, 6).map((c, i) => (
            <Animated.View
              key={c.mediaId}
              entering={reduceMotion ? undefined : FadeIn.delay(i * 70).duration(420)}
              style={[styles.finaleCoverItem, { marginLeft: i === 0 ? 0 : -22, zIndex: 6 - i }]}
            >
              {c.coverImage ? (
                <Image source={{ uri: c.coverImage }} style={styles.finaleCover} contentFit="cover" transition={150} />
              ) : (
                <View style={[styles.finaleCover, styles.posterFallback]} />
              )}
            </Animated.View>
          ))}
        </View>
      )}
      <View style={styles.recapGrid}>
        {recap.map(([v, l]) => (
          <View key={l} style={styles.recapCell}>
            <Text variant="title" style={[styles.recapValue, { color: palette.accent }]} numberOfLines={1}>
              {v}
            </Text>
            <Text variant="caption" style={styles.onMediaMuted}>
              {l}
            </Text>
          </View>
        ))}
      </View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.85 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Share your Wrapped"
      >
        <Ionicons name="share-outline" size={20} color="#0B0B12" />
        <Text variant="callout" style={styles.shareBtnText}>
          {status === 'working' ? 'Preparing…' : 'Share my Wrapped'}
        </Text>
      </Pressable>
      <Text variant="caption" style={[styles.onMediaMuted, styles.shareHint]}>
        {shareHint(status)}
      </Text>
    </Reveal>
  );
}

function shareHint(status: 'idle' | 'working' | ShareResult): string {
  switch (status) {
    case 'downloaded':
      return 'Saved as an image — post it anywhere 🎉';
    case 'shared':
      return 'Shared! 🎉';
    case 'unsupported':
      return 'Sharing the image works in the browser/web app.';
    case 'error':
      return "Couldn't build the image — try again.";
    default:
      return 'Export a 9:16 card for your story or group chat.';
  }
}

// ---------------------------------------------------------------------------
// Small presentational primitives (white-on-gradient throughout)
// ---------------------------------------------------------------------------

function Reveal({ children, reduceMotion }: { children: React.ReactNode; reduceMotion: boolean }) {
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(520).springify().damping(18)}
      style={styles.reveal}
    >
      {children}
    </Animated.View>
  );
}

function Big({ children }: { children: React.ReactNode }) {
  return <Text style={styles.big}>{children}</Text>;
}

function Lead({ children }: { children: React.ReactNode }) {
  return <Text style={styles.lead}>{children}</Text>;
}

function CountUp({
  value,
  accent,
  reduceMotion,
}: {
  value: number;
  accent: string;
  reduceMotion: boolean;
}) {
  const [n, setN] = useState(reduceMotion ? value : 0);
  useEffect(() => {
    if (reduceMotion) {
      setN(value);
      return;
    }
    const start = Date.now();
    const dur = 1100;
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / dur);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduceMotion]);
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(300)}>
      <Text style={[styles.huge, { color: accent }]}>{n.toLocaleString()}</Text>
    </Animated.View>
  );
}

function RoundButton({
  icon,
  onPress,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.roundBtn} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color="#FFFFFF" />
    </Pressable>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  return <RoundButton icon="close" onPress={onPress} label="Close" />;
}

function episodesQuip(n: number): string {
  if (n >= 1000) return "That's a serious dedication arc. Respect.";
  if (n >= 300) return 'A full season of binges, and then some.';
  if (n >= 100) return 'Triple digits — you showed up this year.';
  if (n >= 25) return 'A solid run of late nights.';
  return 'Every great journey starts somewhere.';
}

const onMediaWhite = '#FFFFFF';
const onMediaMuted = 'rgba(255,255,255,0.78)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0B12' },
  // Rendered but parked off-screen so view-shot can capture it on demand.
  captureHost: { position: 'absolute', left: -10000, top: 0 },
  emptyHeader: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, alignItems: 'flex-end' },

  zone: { position: 'absolute', top: 0, bottom: 0, zIndex: 1 },
  zoneLeft: { left: 0, width: '32%' },
  zoneRight: { right: 0, width: '68%' },

  // Above the tap zones so interactive children (Share) are reachable; the View
  // itself is box-none, so taps on empty space still fall through to the zones.
  content: {
    flex: 1,
    paddingHorizontal: spacing['2xl'],
    justifyContent: 'center',
    zIndex: 2,
  },
  reveal: { gap: spacing.md },

  topBar: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: spacing.lg, zIndex: 3 },
  segments: { flexDirection: 'row', gap: 4 },
  segTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  segFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 2 },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  controlsRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandCol: { flex: 1, gap: 2 },
  brand: { color: onMediaMuted, letterSpacing: 1.5 },
  nowPlaying: { color: onMediaWhite, maxWidth: 280 },
  roundBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },

  kicker: {
    color: onMediaMuted,
    fontFamily: 'Jakarta_700',
    fontSize: 18,
    letterSpacing: 0.3,
  },
  big: {
    color: onMediaWhite,
    fontFamily: 'Jakarta_800',
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -0.5,
  },
  huge: {
    fontFamily: 'Jakarta_800',
    fontSize: 96,
    lineHeight: 104,
    letterSpacing: -2,
  },
  lead: {
    color: onMediaMuted,
    fontFamily: 'Jakarta_500',
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 340,
  },
  emoji: { fontSize: 64 },
  onMediaMuted: { color: onMediaMuted },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  statusChip: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },

  genreList: { gap: spacing.lg, marginTop: spacing.sm },
  genreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  genreRank: { color: 'rgba(255,255,255,0.5)', fontFamily: 'Jakarta_800', fontSize: 22, width: 28 },
  genreBarWrap: { flex: 1, gap: 6 },
  genreName: { color: onMediaWhite, fontFamily: 'Jakarta_700', fontSize: 18 },
  genreTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  genreFill: { height: '100%', borderRadius: 4 },
  genreCount: { color: onMediaMuted, fontFamily: 'Jakarta_700', fontSize: 16, width: 28, textAlign: 'right' },

  fan: { flexDirection: 'row', marginBottom: spacing.lg, height: 96, alignItems: 'center' },
  fanItem: {
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  fanPoster: { width: 58, height: 84 },

  mosaicWrap: { gap: spacing.md },
  mosaic: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  mosaicCell: {
    width: '18%',
    aspectRatio: 0.69,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  mosaicPoster: { width: '100%', height: '100%' },

  posterWrap: { alignSelf: 'flex-start', marginVertical: spacing.sm },
  poster: { width: 200, height: 286, borderRadius: radii.lg, backgroundColor: 'rgba(255,255,255,0.1)' },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  posterBadge: {
    position: 'absolute',
    bottom: -14,
    right: -10,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  posterBadgeText: { color: '#0B0B12', fontFamily: 'Jakarta_800' },
  posterTitle: { color: onMediaWhite, marginTop: spacing.sm },

  finaleCovers: { flexDirection: 'row', marginTop: spacing.lg },
  finaleCoverItem: {
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  finaleCover: { width: 56, height: 80 },
  recapGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.lg, marginBottom: spacing.xl },
  recapCell: { width: '50%', paddingVertical: spacing.md },
  recapValue: { fontFamily: 'Jakarta_800' },

  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 54,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.xl,
    // The finale content is box-none (so background taps reach the nav zones);
    // the button must opt back into pointer events to stay tappable.
    pointerEvents: 'auto',
  },
  shareBtnText: { color: '#0B0B12', fontFamily: 'Jakarta_800' },
  shareHint: { textAlign: 'center', marginTop: spacing.md },
});
