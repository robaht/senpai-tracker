import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  useWindowDimensions,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../src/components/ui/Screen';
import { Text } from '../src/components/ui/Text';
import { Badge, withAlpha } from '../src/components/ui/Badge';
import { PressableScale } from '../src/components/ui/PressableScale';
import { ImportFromAniListSheet } from '../src/components/ImportFromAniListSheet';
import { ImportFromMyAnimeListSheet } from '../src/components/ImportFromMyAnimeListSheet';
import { LibraryBackupSheet } from '../src/components/LibraryBackupSheet';
import { usePreferencesStore, useRegion } from '../src/features/preferences/store';
import { REGION_OPTIONS, regionLabel } from '../src/lib/streaming';
import {
  THEME_LIST,
  radii,
  spacing,
  useTheme,
  type ThemeDef,
  type ThemeName,
} from '../src/theme';

const BOTTOM_SPACE = 60;

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const scheme = useColorScheme();
  const { width } = useWindowDimensions();

  const mode = usePreferencesStore((s) => s.mode);
  const manualTheme = usePreferencesStore((s) => s.manualTheme);
  const lightTheme = usePreferencesStore((s) => s.lightTheme);
  const darkTheme = usePreferencesStore((s) => s.darkTheme);
  const setMode = usePreferencesStore((s) => s.setMode);
  const setManualTheme = usePreferencesStore((s) => s.setManualTheme);
  const setLightTheme = usePreferencesStore((s) => s.setLightTheme);
  const setDarkTheme = usePreferencesStore((s) => s.setDarkTheme);

  const region = usePreferencesStore((s) => s.region);
  const setRegion = usePreferencesStore((s) => s.setRegion);
  const resolvedRegion = useRegion();

  const [importOpen, setImportOpen] = useState(false);
  const [malImportOpen, setMalImportOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);

  const following = mode === 'system';
  const systemIsDark = scheme !== 'light'; // treat null as dark

  const lights = THEME_LIST.filter((t) => !t.isDark);
  const darks = THEME_LIST.filter((t) => t.isDark);

  const cardW = (Math.min(width, 640) - spacing.xl * 2 - spacing.md) / 2;

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={[styles.backBtn, { backgroundColor: colors.surfaceHigh }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text variant="title">Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="overline" color="textFaint" style={styles.sectionLabel}>
          LIBRARY
        </Text>
        <Pressable
          onPress={() => setImportOpen(true)}
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Import from AniList"
        >
          <View style={[styles.rowIcon, { backgroundColor: withAlpha(colors.accent, 0.16) }]}>
            <Ionicons name="cloud-download-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.rowText}>
            <Text variant="bodyMedium">Import from AniList</Text>
            <Text variant="caption" color="textFaint">
              Bring in a public AniList user's list by username
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>

        <Pressable
          onPress={() => setMalImportOpen(true)}
          style={[styles.row, styles.rowStacked, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Import from MyAnimeList"
        >
          <View style={[styles.rowIcon, { backgroundColor: withAlpha(colors.accent, 0.16) }]}>
            <Ionicons name="document-text-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.rowText}>
            <Text variant="bodyMedium">Import from MyAnimeList</Text>
            <Text variant="caption" color="textFaint">
              Bring in your MAL list from its XML export file
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>

        <Text variant="overline" color="textFaint" style={styles.sectionLabel}>
          DATA
        </Text>
        <Pressable
          onPress={() => setBackupOpen(true)}
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Back up and restore your library"
        >
          <View style={[styles.rowIcon, { backgroundColor: withAlpha(colors.accent, 0.16) }]}>
            <Ionicons name="save-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.rowText}>
            <Text variant="bodyMedium">Back up & restore</Text>
            <Text variant="caption" color="textFaint">
              Export your library to a file, or restore it from one
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>

        <Text variant="overline" color="textFaint" style={styles.sectionLabel}>
          APPEARANCE
        </Text>

        {/* Follow-system toggle */}
        <View
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View
            style={[styles.rowIcon, { backgroundColor: withAlpha(colors.accent, 0.16) }]}
          >
            <Ionicons name="contrast" size={18} color={colors.accent} />
          </View>
          <View style={styles.rowText}>
            <Text variant="bodyMedium">Follow system</Text>
            <Text variant="caption" color="textFaint">
              Match your device's light or dark mode
            </Text>
          </View>
          <Switch
            value={following}
            onValueChange={(v) => setMode(v ? 'system' : 'manual')}
            trackColor={{ false: colors.surfaceHigh, true: withAlpha(colors.accent, 0.5) }}
            thumbColor={following ? colors.accent : colors.textFaint}
            ios_backgroundColor={colors.surfaceHigh}
          />
        </View>

        {following ? (
          <>
            <GroupHeader title="Dark mode" inUse={systemIsDark} />
            <View style={styles.grid}>
              {darks.map((def) => (
                <ThemeCard
                  key={def.name}
                  def={def}
                  width={cardW}
                  selected={darkTheme === def.name}
                  inUse={systemIsDark && darkTheme === def.name}
                  onPress={() => setDarkTheme(def.name)}
                />
              ))}
            </View>

            <GroupHeader title="Light mode" inUse={!systemIsDark} />
            <View style={styles.grid}>
              {lights.map((def) => (
                <ThemeCard
                  key={def.name}
                  def={def}
                  width={cardW}
                  selected={lightTheme === def.name}
                  inUse={!systemIsDark && lightTheme === def.name}
                  onPress={() => setLightTheme(def.name)}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <Text variant="overline" color="textFaint" style={styles.sectionLabel}>
              THEME
            </Text>
            <View style={styles.grid}>
              {THEME_LIST.map((def) => (
                <ThemeCard
                  key={def.name}
                  def={def}
                  width={cardW}
                  selected={manualTheme === def.name}
                  onPress={() => setManualTheme(def.name)}
                />
              ))}
            </View>
          </>
        )}

        <Text variant="overline" color="textFaint" style={styles.sectionLabel}>
          STREAMING REGION
        </Text>
        <Text variant="caption" color="textFaint" style={styles.regionHint}>
          {region === null
            ? resolvedRegion
              ? `Following this device — ${regionLabel(resolvedRegion).flag} ${regionLabel(resolvedRegion).label}. Tailors "Where to watch" links.`
              : 'Tailors "Where to watch" links to your country.'
            : 'Tailors "Where to watch" links to the region you picked.'}
        </Text>
        <View style={styles.regionWrap}>
          {REGION_OPTIONS.map((opt) => {
            const selected = (region ?? '') === opt.code;
            return (
              <Pressable
                key={opt.code || 'auto'}
                onPress={() => setRegion(opt.code === '' ? null : opt.code)}
                style={[
                  styles.regionChip,
                  {
                    backgroundColor: selected ? withAlpha(colors.accent, 0.16) : colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={opt.label}
              >
                <Text variant="callout">{opt.flag}</Text>
                <Text variant="callout" color={selected ? colors.accent : undefined}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="caption" color="textFaint" style={styles.footnote}>
          Themes and region apply instantly and are saved on this device.
        </Text>
      </ScrollView>

      <ImportFromAniListSheet visible={importOpen} onClose={() => setImportOpen(false)} />
      <ImportFromMyAnimeListSheet visible={malImportOpen} onClose={() => setMalImportOpen(false)} />
      <LibraryBackupSheet visible={backupOpen} onClose={() => setBackupOpen(false)} />
    </Screen>
  );
}

function GroupHeader({ title, inUse }: { title: string; inUse: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.groupHeader}>
      <Text variant="overline" color="textFaint">
        {title.toUpperCase()}
      </Text>
      {inUse && <Badge label="Active now" color={colors.accent} />}
    </View>
  );
}

function ThemeCard({
  def,
  width,
  selected,
  inUse,
  onPress,
}: {
  def: ThemeDef;
  width: number;
  selected: boolean;
  inUse?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.97}
      style={{ width }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${def.label} theme`}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: selected ? colors.accent : colors.border,
            borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        <View>
          <ThemePreview def={def} width={width - 16} />
          {inUse && (
            <View style={styles.inUseTag}>
              <Badge label="In use" color={colors.accent} variant="solid" />
            </View>
          )}
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.cardLabel}>
            <Text variant="callout" numberOfLines={1}>
              {def.label}
            </Text>
            <Text variant="caption" color="textFaint" numberOfLines={1}>
              {def.blurb}
            </Text>
          </View>
          {selected ? (
            <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
          ) : (
            <View
              style={[styles.radio, { borderColor: colors.borderStrong }]}
            />
          )}
        </View>
      </View>
    </PressableScale>
  );
}

/** A miniature of the app rendered entirely in the given theme's own palette. */
function ThemePreview({ def, width }: { def: ThemeDef; width: number }) {
  const c = def.colors;
  const g = def.gradients;
  const h = Math.round(width * 0.74);
  const posterH = Math.round(h * 0.34);
  return (
    <View
      style={[
        styles.preview,
        { width, height: h, backgroundColor: c.bg, borderColor: c.border },
      ]}
    >
      <View style={styles.previewTop}>
        <View style={styles.previewTitleCol}>
          <View style={{ width: width * 0.36, height: 7, borderRadius: 4, backgroundColor: c.text }} />
          <View style={{ width: width * 0.22, height: 5, borderRadius: 3, backgroundColor: c.textMuted }} />
        </View>
        <LinearGradient
          colors={g.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.previewAvatar}
        />
      </View>

      <View
        style={[styles.previewSearch, { backgroundColor: c.surface, borderColor: c.border }]}
      />

      <View style={styles.previewPosters}>
        <View style={{ flex: 1, height: posterH, borderRadius: 6, backgroundColor: c.surfaceHigh }} />
        <LinearGradient
          colors={g.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, height: posterH, borderRadius: 6 }}
        />
        <View style={{ flex: 1, height: posterH, borderRadius: 6, backgroundColor: c.surfaceElevated }} />
      </View>

      <View style={styles.previewPillRow}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }} />
        <View
          style={{
            width: width * 0.32,
            height: 8,
            borderRadius: 999,
            backgroundColor: withAlpha(c.accent, 0.32),
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: BOTTOM_SPACE,
  },
  sectionLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowStacked: {
    marginTop: spacing.sm,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    borderRadius: radii.xl,
    padding: 8,
    gap: spacing.sm,
  },
  inUseTag: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  cardLabel: {
    flex: 1,
    gap: 1,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  preview: {
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    justifyContent: 'space-between',
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewTitleCol: {
    gap: 4,
  },
  previewAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  previewSearch: {
    height: 12,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewPosters: {
    flexDirection: 'row',
    gap: 6,
  },
  previewPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footnote: {
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  regionHint: {
    marginBottom: spacing.md,
  },
  regionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
