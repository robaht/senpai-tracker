import { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useGoBack } from '../../src/lib/useGoBack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { withAlpha } from '../../src/components/ui/Badge';
import { CountdownPill } from '../../src/components/CountdownPill';
import { AddToListSheet } from '../../src/components/AddToListSheet';
import { EmptyState } from '../../src/components/EmptyState';
import { RelationsRail } from '../../src/components/RelationsRail';
import { RecommendationsRail } from '../../src/components/RecommendationsRail';
import { CharacterRail } from '../../src/components/CharacterRail';
import { TrailerCard } from '../../src/components/TrailerCard';
import { StreamingLinks } from '../../src/components/StreamingLinks';
import { RatingStars } from '../../src/components/RatingStars';
import { useAnime } from '../../src/api/anilist/hooks';
import { displayTitle } from '../../src/api/anilist';
import { useTrackEntry, useTrackingStore } from '../../src/features/tracking/store';
import { useComfortStore, useIsComfort } from '../../src/features/comfort/store';
import { STATUS_META, statusColor } from '../../src/features/tracking/types';
import { formatScore, humanizeEnum, stripHtml } from '../../src/lib/format';
import { radii, spacing, makeStyles, useTheme } from '../../src/theme';

export default function AnimeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mediaId = Number(id);
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const styles = useStyles();

  const { data: media, isLoading, isError } = useAnime(mediaId);
  const entry = useTrackEntry(mediaId);
  const isComfort = useIsComfort(mediaId);
  const toggleComfort = useComfortStore((s) => s.toggle);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const bannerHeight = Math.min(width * 0.62, 320);

  // Scroll drives the parallax banner and the fade-in title bar.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const bannerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [-bannerHeight, 0, bannerHeight],
          [-bannerHeight * 0.5, 0, bannerHeight * 0.3],
          'clamp',
        ),
      },
      { scale: interpolate(scrollY.value, [-bannerHeight, 0], [2, 1], 'clamp') },
    ],
  }));

  const headerBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [bannerHeight * 0.45, bannerHeight * 0.75],
      [0, 1],
      'clamp',
    ),
  }));

  // Fade the art into the active theme's background so the banner blends into
  // the content surface in every theme (dark fades to ink, light to cream/white).
  const bannerFade = ['transparent', withAlpha(colors.bg, 0.55), colors.bg] as const;

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Parallax banner */}
        <Animated.View
          style={[
            styles.banner,
            { height: bannerHeight, backgroundColor: media?.coverImage?.color ?? colors.surface },
            bannerStyle,
          ]}
        >
          {media && (
            <Image
              source={media.bannerImage ?? media.coverImage?.extraLarge ?? undefined}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={300}
            />
          )}
          <LinearGradient colors={bannerFade} style={StyleSheet.absoluteFill} />
        </Animated.View>

        {isLoading ? (
          <DetailSkeleton />
        ) : isError || !media ? (
          <EmptyState emoji="😵" title="Couldn't load this title" subtitle="Please try again later." />
        ) : (
          <View style={styles.content}>
            {/* Poster + title header */}
            <View style={styles.headRow}>
              <View style={[styles.posterWrap, { backgroundColor: media.coverImage?.color ?? colors.surface }]}>
                <Image
                  source={media.coverImage?.extraLarge ?? media.coverImage?.large ?? undefined}
                  style={styles.poster}
                  contentFit="cover"
                  transition={250}
                />
              </View>
              <View style={styles.headInfo}>
                <Text variant="title" numberOfLines={3}>
                  {displayTitle(media.title)}
                </Text>
                {media.title.native && (
                  <Text variant="caption" color="textFaint" numberOfLines={1}>
                    {media.title.native}
                  </Text>
                )}
                <View style={styles.metaRow}>
                  {formatScore(media.averageScore) && (
                    <Text variant="callout" color={colors.warning}>
                      ★ {formatScore(media.averageScore)}
                    </Text>
                  )}
                  {media.format && (
                    <Text variant="callout" color="textMuted">
                      {humanizeEnum(media.format)}
                    </Text>
                  )}
                  {media.episodes != null && (
                    <Text variant="callout" color="textMuted">
                      {media.episodes} eps
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {media.nextAiringEpisode && (
              <View style={styles.airing}>
                <CountdownPill next={media.nextAiringEpisode} />
              </View>
            )}

            {/* Primary action / tracking state */}
            {entry ? (
              <TrackingPanel mediaId={mediaId} onChangeStatus={() => setSheetOpen(true)} />
            ) : (
              <Button
                label="Add to list"
                fullWidth
                icon={<Ionicons name="add" size={20} color={colors.onAccent} />}
                onPress={() => setSheetOpen(true)}
                style={styles.addBtn}
              />
            )}

            {/* Comfort Corner toggle — a curated comfort pick, independent of status */}
            <Button
              label={isComfort ? 'In your Comfort Corner' : 'Add to Comfort'}
              variant="secondary"
              fullWidth
              icon={
                <Ionicons
                  name={isComfort ? 'cafe' : 'cafe-outline'}
                  size={18}
                  color={isComfort ? colors.accentAlt : colors.text}
                />
              }
              onPress={() => toggleComfort(media)}
              style={styles.comfortBtn}
            />

            {/* Genres */}
            {media.genres.length > 0 && (
              <View style={styles.genres}>
                {media.genres.map((g) => (
                  <Badge key={g} label={g} color={colors.accentSoft} />
                ))}
              </View>
            )}

            {/* Trailer (renders nothing when there's no playable trailer) */}
            <TrailerCard trailer={media.trailer} />

            {/* Where to watch — region-aware streaming links */}
            <StreamingLinks links={media.externalLinks} />

            {/* Synopsis */}
            {media.description && (
              <View style={styles.section}>
                <Text variant="heading" style={styles.sectionTitle}>
                  Synopsis
                </Text>
                <Text
                  variant="body"
                  color="textMuted"
                  numberOfLines={descExpanded ? undefined : 4}
                >
                  {stripHtml(media.description)}
                </Text>
                <Pressable onPress={() => setDescExpanded((v) => !v)} hitSlop={8}>
                  <Text variant="callout" color={colors.accent} style={styles.readMore}>
                    {descExpanded ? 'Show less' : 'Read more'}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Info card */}
            <Card style={styles.section}>
              <InfoRow label="Status" value={humanizeEnum(media.status) || '—'} />
              {media.studios?.nodes?.length ? (
                <InfoRow label="Studio" value={media.studios.nodes.map((s) => s.name).join(', ')} />
              ) : null}
              {media.season && media.seasonYear ? (
                <InfoRow
                  label="Season"
                  value={`${media.season.charAt(0) + media.season.slice(1).toLowerCase()} ${media.seasonYear}`}
                />
              ) : null}
              {media.duration ? <InfoRow label="Episode length" value={`${media.duration} min`} /> : null}
              {media.popularity ? (
                <InfoRow label="Popularity" value={`#${media.popularity.toLocaleString()}`} last />
              ) : null}
            </Card>

            {/* Cast — tap a character for role + voice actor */}
            <CharacterRail media={media} />

            {/* Related anime / season chain */}
            <RelationsRail media={media} />

            {/* "More like this" — community recommendations */}
            <RecommendationsRail mediaId={media.id} />
          </View>
        )}
      </Animated.ScrollView>

      {/* Fade-in title bar (purely visual; the floating back button handles taps). */}
      <Animated.View
        style={[styles.headerBar, { height: insets.top + 50 }, headerBarStyle]}
      >
        <BlurView
          intensity={40}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: withAlpha(colors.bg, 0.7), borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
          ]}
        />
        <View style={[styles.headerBarContent, { paddingTop: insets.top }]}>
          <Text variant="subheading" numberOfLines={1} style={styles.headerBarTitle}>
            {media ? displayTitle(media.title) : ''}
          </Text>
        </View>
      </Animated.View>

      {/* Floating back button */}
      <Pressable
        onPress={goBack}
        style={[styles.backBtn, { backgroundColor: colors.mediaBorder, top: insets.top + spacing.sm }]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={24} color={colors.onMedia} />
      </Pressable>

      <AddToListSheet media={media ?? null} visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

/** Inline tracking controls shown when an anime is already on the list. */
function TrackingPanel({
  mediaId,
  onChangeStatus,
}: {
  mediaId: number;
  onChangeStatus: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const entry = useTrackEntry(mediaId);
  const increment = useTrackingStore((s) => s.incrementProgress);
  const setProgress = useTrackingStore((s) => s.setProgress);
  const setScore = useTrackingStore((s) => s.setScore);
  if (!entry) return null;
  const meta = STATUS_META[entry.status];
  const atMax = entry.totalEpisodes != null && entry.progress >= entry.totalEpisodes;

  return (
    <Card elevated style={styles.panel}>
      <Pressable style={styles.panelStatus} onPress={onChangeStatus}>
        <View style={[styles.statusDot, { backgroundColor: statusColor(colors, entry.status) }]} />
        <Text variant="subheading">{meta.label}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textFaint} style={styles.panelChevron} />
      </Pressable>

      <View style={styles.stepper}>
        <Pressable
          onPress={() => setProgress(mediaId, entry.progress - 1)}
          disabled={entry.progress <= 0}
          style={[styles.stepBtn, entry.progress <= 0 && styles.stepDisabled]}
          hitSlop={6}
        >
          <Ionicons name="remove" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.stepCount}>
          <Text variant="heading">{entry.progress}</Text>
          <Text variant="caption" color="textFaint">
            {entry.totalEpisodes ? `of ${entry.totalEpisodes}` : 'episodes'}
          </Text>
        </View>
        <Pressable
          onPress={() => increment(mediaId)}
          disabled={atMax}
          style={[styles.stepBtn, styles.stepBtnPrimary, atMax && styles.stepDisabled]}
          hitSlop={6}
        >
          <Ionicons name="add" size={20} color={colors.onAccent} />
        </Pressable>
      </View>

      <View style={styles.panelDivider} />
      <RatingStars value={entry.score} onChange={(v) => setScore(mediaId, v)} />
    </Card>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.infoRow, !last && styles.infoBorder]}>
      <Text variant="callout" color="textFaint">
        {label}
      </Text>
      <Text variant="callout" style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function DetailSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.content}>
      <View style={styles.headRow}>
        <Skeleton width={108} height={162} radius={radii.md} />
        <View style={styles.headInfo}>
          <Skeleton width="90%" height={24} />
          <Skeleton width="50%" height={14} />
          <Skeleton width="70%" height={14} />
        </View>
      </View>
      <Skeleton width="100%" height={50} radius={radii.md} style={{ marginTop: spacing.xl }} />
      <Skeleton width="100%" height={120} radius={radii.lg} style={{ marginTop: spacing.xl }} />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing['5xl'] },
  banner: { width: '100%' },
  content: {
    paddingHorizontal: spacing.xl,
    marginTop: -64, // pull poster up over the banner
  },
  headRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-end',
  },
  posterWrap: {
    width: 108,
    height: 162,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  poster: { width: '100%', height: '100%' },
  headInfo: {
    flex: 1,
    gap: 6,
    paddingBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 2,
  },
  airing: { marginTop: spacing.lg },
  addBtn: { marginTop: spacing.xl },
  comfortBtn: { marginTop: spacing.md },
  panel: { marginTop: spacing.xl, gap: spacing.lg },
  panelDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  panelStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  panelChevron: { marginLeft: 'auto' },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPrimary: { backgroundColor: colors.accent },
  stepDisabled: { opacity: 0.4 },
  stepCount: { alignItems: 'center', gap: 2 },
  genres: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  section: { marginTop: spacing['2xl'] },
  sectionTitle: { marginBottom: spacing.sm },
  readMore: { marginTop: spacing.sm },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  infoBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoValue: { flex: 1, textAlign: 'right' },
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  headerBarContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 56,
  },
  headerBarTitle: { textAlign: 'center' },
  backBtn: {
    position: 'absolute',
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
