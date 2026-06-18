import { forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../../components/ui/Text';
import type { WrappedSummary } from '../stats/wrapped';
import type { Palette } from './colors';

/**
 * The off-screen 9:16 card captured by `react-native-view-shot` for the native
 * share (see `shareCard.native.ts`). Because native capture reads real pixels
 * (no canvas/CORS limit), this includes the actual cover art — the export the
 * web canvas can't produce. Rendered hidden by the Wrapped screen on native.
 *
 * Self-contained white-on-gradient styling (no theme tokens that vary), so the
 * exported image looks identical regardless of the active app theme.
 */

const W = 360;
const H = 640;

export const WrappedShareCard = forwardRef<View, { summary: WrappedSummary; palette: Palette }>(
  function WrappedShareCard({ summary: s, palette }, ref) {
    const covers = s.covers.filter((c) => c.coverImage).slice(0, 6);
    const stats: Array<[string, string]> = [
      [fmt(s.episodes), 'episodes'],
      [fmt(s.hours), 'hours'],
      [fmt(s.completed), 'completed'],
    ];
    const swatches = s.covers.map((c) => c.coverColor).filter((c): c is string => !!c).slice(0, 9);

    return (
      <View ref={ref} collapsable={false} style={styles.root}>
        <LinearGradient colors={[palette.from, palette.to]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.body}>
          <Text style={styles.brand}>SENPAI</Text>
          <Text style={styles.year}>{s.year}</Text>
          <Text style={[styles.wrapped, { color: palette.accent }]}>WRAPPED</Text>

          {covers.length > 0 && (
            <View style={styles.covers}>
              {covers.map((c, i) => (
                <View key={c.mediaId} style={[styles.coverItem, { marginLeft: i === 0 ? 0 : -14, zIndex: 6 - i }]}>
                  <Image source={{ uri: c.coverImage! }} style={styles.cover} contentFit="cover" />
                </View>
              ))}
            </View>
          )}

          <View style={styles.stats}>
            {stats.map(([v, l]) => (
              <View key={l} style={styles.statRow}>
                <Text style={styles.statValue}>{v}</Text>
                <Text style={styles.statLabel}>{l}</Text>
              </View>
            ))}
          </View>

          {swatches.length >= 3 && (
            <View style={styles.swatches}>
              {swatches.map((color, i) => (
                <View key={i} style={[styles.swatch, { backgroundColor: color }]} />
              ))}
            </View>
          )}

          <View style={styles.archetype}>
            <Text style={styles.archetypeEmoji}>{s.archetype.emoji}</Text>
            <View style={styles.archetypeText}>
              <Text style={styles.archetypeKicker}>YOUR ANIME PERSONALITY</Text>
              <Text style={styles.archetypeName}>{s.archetype.name}</Text>
            </View>
          </View>

          <Text style={styles.footer}>
            {s.topGenres[0]?.key ? `Top genre · ${s.topGenres[0].key}   ·   ${fmt(s.titles)} titles` : `${fmt(s.titles)} titles`}
          </Text>
        </View>
      </View>
    );
  },
);

const fmt = (n: number) => n.toLocaleString();

const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.72)';

const styles = StyleSheet.create({
  root: { width: W, height: H, overflow: 'hidden', backgroundColor: '#0B0B12' },
  body: { flex: 1, paddingHorizontal: 32, paddingVertical: 44, justifyContent: 'space-between' },
  brand: { color: MUTED, fontFamily: 'Jakarta_700', fontSize: 12, letterSpacing: 3 },
  year: { color: WHITE, fontFamily: 'Jakarta_800', fontSize: 52, lineHeight: 56, letterSpacing: -1 },
  wrapped: { fontFamily: 'Jakarta_800', fontSize: 38, lineHeight: 40, letterSpacing: -0.5 },
  covers: { flexDirection: 'row', marginTop: 4 },
  coverItem: {
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cover: { width: 44, height: 64 },
  stats: { gap: 10 },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  statValue: { color: WHITE, fontFamily: 'Jakarta_800', fontSize: 40, lineHeight: 44 },
  statLabel: { color: MUTED, fontFamily: 'Jakarta_600', fontSize: 15 },
  swatches: { flexDirection: 'row', gap: 6 },
  swatch: { flex: 1, height: 28, borderRadius: 7 },
  archetype: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18,
    padding: 16,
  },
  archetypeEmoji: { fontSize: 34 },
  archetypeText: { flex: 1, gap: 2 },
  archetypeKicker: { color: MUTED, fontFamily: 'Jakarta_700', fontSize: 11, letterSpacing: 1 },
  archetypeName: { color: WHITE, fontFamily: 'Jakarta_800', fontSize: 20 },
  footer: { color: MUTED, fontFamily: 'Jakarta_600', fontSize: 13 },
});
