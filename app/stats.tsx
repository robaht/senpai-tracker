import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useGoBack } from '../src/lib/useGoBack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../src/components/ui/PressableScale';
import { Screen } from '../src/components/ui/Screen';
import { Text } from '../src/components/ui/Text';
import { Card } from '../src/components/ui/Card';
import { SectionHeader } from '../src/components/SectionHeader';
import { EmptyState } from '../src/components/EmptyState';
import { withAlpha } from '../src/components/ui/Badge';
import { useStats, type Count } from '../src/features/stats';
import { STATUS_META, statusColor, type WatchStatus } from '../src/features/tracking/types';
import { humanizeEnum } from '../src/lib/format';
import { radii, spacing, makeStyles, useTheme } from '../src/theme';

export default function StatsScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  const stats = useStats();

  const maxStatus = Math.max(1, ...stats.perStatus.map((s) => s.count));
  const maxScore = Math.max(1, ...stats.scoreDistribution);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text variant="display">Your stats</Text>
      </View>

      {stats.titles === 0 ? (
        <EmptyState
          emoji="📊"
          title="No stats yet"
          subtitle="Track a few shows and your watch insights will appear here."
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* Wrapped entry */}
          <PressableScale
            onPress={() => router.push('/wrapped')}
            accessibilityRole="button"
            accessibilityLabel="Open your Anime Wrapped"
          >
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.wrappedBanner}
            >
              <View style={styles.wrappedText}>
                <Text variant="overline" color={colors.onMedia} style={styles.wrappedKicker}>
                  NEW · {new Date().getFullYear()}
                </Text>
                <Text variant="heading" color={colors.onMedia}>
                  Your Anime Wrapped
                </Text>
                <Text variant="caption" color={colors.onMediaMuted}>
                  A swipeable, shareable year in review
                </Text>
              </View>
              <View style={styles.wrappedPlay}>
                <Ionicons name="play" size={22} color={colors.onMedia} />
              </View>
            </LinearGradient>
          </PressableScale>

          {/* Hero totals */}
          <View style={[styles.tiles, styles.tilesSpaced]}>
            <StatTile value={fmt(stats.titles)} label={stats.titles === 1 ? 'Title' : 'Titles'} />
            <StatTile value={fmt(stats.episodes)} label="Episodes" />
            <StatTile
              value={fmt(stats.hours)}
              label="Hours"
              caption={stats.hoursEstimated ? '≈ estimate' : undefined}
            />
          </View>

          {/* By status */}
          <View style={styles.section}>
            <SectionHeader title="By status" />
            <Card>
              {stats.perStatus.map((s, i) => (
                <View key={s.key} style={[styles.barRow, i > 0 && styles.barRowGap]}>
                  <View style={styles.barLabelRow}>
                    <View style={styles.barLabelLeft}>
                      <View style={[styles.dot, { backgroundColor: statusColor(colors, s.key as WatchStatus) }]} />
                      <Text variant="callout" color="textMuted">
                        {STATUS_META[s.key as WatchStatus].label}
                      </Text>
                    </View>
                    <Text variant="callout">{s.count}</Text>
                  </View>
                  <Track
                    ratio={s.count / maxStatus}
                    color={statusColor(colors, s.key as WatchStatus)}
                  />
                </View>
              ))}
            </Card>
          </View>

          {/* Scores */}
          {stats.scoredCount > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Scores" caption={`${stats.scoredCount} scored`} />
              <Card>
                <View style={styles.scoreHead}>
                  <Text variant="display" color={colors.warning}>
                    {stats.scoreMean.toFixed(1)}
                  </Text>
                  <Text variant="callout" color="textFaint" style={styles.scoreHeadLabel}>
                    mean score
                  </Text>
                </View>
                <View style={styles.scoreBars}>
                  {stats.scoreDistribution.map((count, idx) => (
                    <View key={idx} style={styles.scoreCol}>
                      <View style={styles.scoreBarTrack}>
                        <View
                          style={[
                            styles.scoreBarFill,
                            {
                              height: `${Math.round((count / maxScore) * 100)}%`,
                              backgroundColor: count > 0 ? colors.warning : 'transparent',
                            },
                          ]}
                        />
                      </View>
                      <Text variant="overline" color="textFaint">
                        {idx + 1}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            </View>
          )}

          {/* Top genres */}
          {stats.topGenres.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Top genres" />
              <Card>
                <CountBars data={stats.topGenres} color={colors.accent} />
              </Card>
            </View>
          )}

          {/* Formats */}
          {stats.formats.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Formats" />
              <Card>
                <CountBars data={stats.formats} color={colors.accentAlt} humanize />
              </Card>
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

/** Big-number tile for the hero totals row. */
function StatTile({ value, label, caption }: { value: string; label: string; caption?: string }) {
  const styles = useStyles();
  return (
    <Card style={styles.tile}>
      <Text variant="title">{value}</Text>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      {caption && (
        <Text variant="overline" color="textFaint">
          {caption}
        </Text>
      )}
    </Card>
  );
}

/** A list of label + proportional horizontal bar rows. */
function CountBars({ data, color, humanize }: { data: Count[]; color: string; humanize?: boolean }) {
  const styles = useStyles();
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <>
      {data.map((d, i) => (
        <View key={d.key} style={[styles.barRow, i > 0 && styles.barRowGap]}>
          <View style={styles.barLabelRow}>
            <Text variant="callout" color="textMuted">
              {humanize ? humanizeEnum(d.key) : d.key}
            </Text>
            <Text variant="callout">{d.count}</Text>
          </View>
          <Track ratio={d.count / max} color={color} />
        </View>
      ))}
    </>
  );
}

/** A thin proportional bar with a faint track behind it. */
function Track({ ratio, color }: { ratio: number; color: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.track, { backgroundColor: withAlpha(color, 0.16) }]}>
      <View style={[styles.trackFill, { width: `${Math.max(4, Math.round(ratio * 100))}%`, backgroundColor: color }]} />
    </View>
  );
}

const fmt = (n: number) => n.toLocaleString();

const useStyles = makeStyles(({ colors }) => ({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing['5xl'],
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tilesSpaced: { marginTop: spacing.lg },
  wrappedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xl,
  },
  wrappedText: { flex: 1, gap: 2 },
  wrappedKicker: { marginBottom: spacing.xs },
  wrappedPlay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tile: {
    flex: 1,
    gap: 2,
    alignItems: 'flex-start',
  },
  section: { marginTop: spacing['2xl'] },
  barRow: {},
  barRowGap: { marginTop: spacing.lg },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  barLabelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  scoreHeadLabel: {},
  scoreBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    height: 96,
  },
  scoreCol: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  scoreBarTrack: {
    width: '100%',
    height: 76,
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  scoreBarFill: {
    width: '100%',
    borderRadius: radii.sm,
  },
}));
