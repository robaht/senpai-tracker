import { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { radii, spacing, useTheme } from '../theme';
import { withAlpha } from './ui/Badge';
import { Text } from './ui/Text';
import { Button } from './ui/Button';
import { BottomSheet } from './ui/BottomSheet';
import type { ImportedListEntry } from '../api/anilist';
import {
  parseMalXml,
  resolveMalEntries,
  type MalEntry,
  type ResolveProgress,
} from '../lib/malImport';
import { useTrackingStore, type ImportMode, type ImportSummary } from '../features/tracking/store';

interface ImportFromMyAnimeListSheetProps {
  visible: boolean;
  onClose: () => void;
}

type Phase = 'input' | 'loading' | 'found' | 'done' | 'error';

/** Read a picked file's raw bytes — web via the File API, native via expo-file-system. */
async function readPickedBytes(asset: DocumentPicker.DocumentPickerAsset): Promise<Uint8Array> {
  if (Platform.OS === 'web' && asset.file) {
    return new Uint8Array(await asset.file.arrayBuffer());
  }
  return new File(asset.uri).bytes();
}

/**
 * Import a MyAnimeList list from its XML export (the `.xml.gz` the user downloads
 * from MAL's website — the app has no export). Flow: pick file → parse + resolve
 * MAL ids to AniList → choose Merge or Replace → summary with any unresolved.
 */
export function ImportFromMyAnimeListSheet({ visible, onClose }: ImportFromMyAnimeListSheetProps) {
  const { colors } = useTheme();
  const importFromList = useTrackingStore((s) => s.importFromList);
  const trackedCount = useTrackingStore((s) => Object.keys(s.entries).length);

  const [phase, setPhase] = useState<Phase>('input');
  const [progress, setProgress] = useState<ResolveProgress | null>(null);
  const [list, setList] = useState<ImportedListEntry[]>([]);
  const [unresolved, setUnresolved] = useState<MalEntry[]>([]);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  // Fresh start each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setPhase('input');
      setProgress(null);
      setList([]);
      setUnresolved([]);
      setError('');
      setSummary(null);
    }
  }, [visible]);

  const pickAndResolve = async () => {
    let asset: DocumentPicker.DocumentPickerAsset;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return; // user backed out — stay on input
      asset = res.assets[0];
    } catch {
      setError("Couldn't open the file picker. Try again.");
      setPhase('error');
      return;
    }

    setPhase('loading');
    setProgress(null);
    try {
      const bytes = await readPickedBytes(asset);
      const parsed = parseMalXml(bytes);
      if (parsed.length === 0) {
        setError(
          "That file doesn't look like a MyAnimeList export. Use Profile → Settings → Import/Export → Export on myanimelist.net to download your list, then pick the .xml.gz file.",
        );
        setPhase('error');
        return;
      }
      const result = await resolveMalEntries(parsed, setProgress);
      if (result.list.length === 0) {
        setError(
          `Read ${parsed.length} ${parsed.length === 1 ? 'title' : 'titles'}, but none could be matched on AniList. Nothing to import.`,
        );
        setPhase('error');
        return;
      }
      setList(result.list);
      setUnresolved(result.unresolved);
      setPhase('found');
    } catch {
      setError("Couldn't read that file. Make sure it's the MAL .xml.gz (or .xml) export.");
      setPhase('error');
    }
  };

  const apply = (mode: ImportMode) => {
    setSummary(importFromList(list, mode));
    setPhase('done');
  };

  const pct = progress && progress.total > 0 ? progress.resolved / progress.total : 0;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text variant="caption" color="textFaint" uppercase>
        Import from MyAnimeList
      </Text>

      {phase === 'input' && (
        <>
          <Text variant="heading" style={styles.title}>
            Bring in your MAL list
          </Text>
          <Text variant="callout" color="textMuted" style={styles.body}>
            On myanimelist.net, open Profile → Settings → Import/Export → Export to download your
            list, then pick the .xml.gz file here. We'll match each title to AniList — status,
            progress and scores come across.
          </Text>
          <Button label="Choose export file" fullWidth onPress={pickAndResolve} style={styles.action} />
        </>
      )}

      {phase === 'loading' && (
        <>
          <Text variant="heading" style={styles.title}>
            {progress ? 'Matching titles…' : 'Reading file…'}
          </Text>
          <Text variant="callout" color="textMuted" style={styles.body}>
            {progress
              ? `Resolving ${progress.resolved} of ${progress.total} on AniList`
              : 'Parsing your export.'}
          </Text>
          <View style={[styles.track, { backgroundColor: colors.surfaceHigh }]}>
            <View
              style={[
                styles.fill,
                { backgroundColor: colors.accent, width: `${Math.round((progress ? pct : 0.08) * 100)}%` },
              ]}
            />
          </View>
        </>
      )}

      {phase === 'error' && (
        <>
          <Text variant="heading" style={styles.title}>
            Couldn't import
          </Text>
          <Text variant="callout" color="textMuted" style={styles.body}>
            {error}
          </Text>
          <Button label="Try again" fullWidth onPress={() => setPhase('input')} style={styles.action} />
        </>
      )}

      {phase === 'found' && (
        <>
          <Text variant="heading" style={styles.title}>
            Matched {list.length} {list.length === 1 ? 'title' : 'titles'}
          </Text>
          <Text variant="callout" color="textMuted" style={styles.body}>
            {trackedCount === 0
              ? 'Add them to your library.'
              : `Merge keeps your newer changes per title. Replace swaps your current ${trackedCount} ${trackedCount === 1 ? 'title' : 'titles'} for this list.`}
            {unresolved.length > 0
              ? ` ${unresolved.length} ${unresolved.length === 1 ? 'title' : 'titles'} couldn't be matched on AniList and will be skipped.`
              : ''}
          </Text>
          <Button
            label={trackedCount === 0 ? `Import ${list.length}` : 'Merge into my list'}
            fullWidth
            onPress={() => apply('merge')}
            style={styles.action}
          />
          {trackedCount > 0 && (
            <Button
              label="Replace my list"
              fullWidth
              variant="ghost"
              onPress={() => apply('replace')}
              style={styles.actionGhost}
            />
          )}
        </>
      )}

      {phase === 'done' && summary && (
        <>
          <View style={styles.doneHead}>
            <Ionicons name="checkmark-circle" size={22} color={colors.positive} />
            <Text variant="heading">Import complete</Text>
          </View>
          <Text variant="callout" color="textMuted" style={styles.body}>
            {summary.added} added · {summary.updated} updated · {summary.unchanged} unchanged
            {unresolved.length > 0 ? ` · ${unresolved.length} skipped` : ''}
          </Text>
          {unresolved.length > 0 && (
            <View style={[styles.skipBox, { backgroundColor: withAlpha(colors.warning, 0.1) }]}>
              <Text variant="caption" color="textMuted">
                Not matched on AniList: {unresolved.slice(0, 6).map((e) => e.title).join(', ')}
                {unresolved.length > 6 ? ` +${unresolved.length - 6} more` : ''}
              </Text>
            </View>
          )}
          <Button label="Done" fullWidth onPress={onClose} style={styles.action} />
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 2, marginBottom: spacing.sm },
  body: { marginBottom: spacing.lg },
  action: { marginTop: spacing.lg },
  actionGhost: { marginTop: spacing.xs },
  track: {
    height: 8,
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  doneHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  skipBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
});
