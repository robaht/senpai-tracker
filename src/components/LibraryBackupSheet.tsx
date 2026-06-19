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
import {
  BACKUP_MIME,
  backupFileName,
  entriesToXml,
  parseLibraryXml,
} from '../lib/libraryBackup';
import { saveTextFile, type SaveResult } from '../lib/saveFile';
import { useTrackingStore, type ImportMode, type ImportSummary } from '../features/tracking/store';
import type { TrackEntry } from '../features/tracking/types';

interface LibraryBackupSheetProps {
  visible: boolean;
  onClose: () => void;
}

type Phase = 'home' | 'exporting' | 'exported' | 'restoreLoading' | 'restoreReview' | 'restoreDone' | 'error';

/** Read a picked file's text — web via the File API, native via expo-file-system. */
async function readPickedText(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web' && asset.file) return asset.file.text();
  return new File(asset.uri).text();
}

/**
 * Back up the tracked library to an XML file and restore it later. Until accounts
 * + cloud sync (F1) ship, this is the only way to keep a list safe across a
 * reinstall or device — export here, re-import the same file with merge/replace.
 */
export function LibraryBackupSheet({ visible, onClose }: LibraryBackupSheetProps) {
  const { colors } = useTheme();
  const restoreEntries = useTrackingStore((s) => s.restoreEntries);
  const trackedCount = useTrackingStore((s) => Object.keys(s.entries).length);

  const [phase, setPhase] = useState<Phase>('home');
  const [result, setResult] = useState<SaveResult>('downloaded');
  const [fileName, setFileName] = useState('');
  const [exportedCount, setExportedCount] = useState(0);
  const [parsed, setParsed] = useState<TrackEntry[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setPhase('home');
      setParsed([]);
      setSummary(null);
      setError('');
    }
  }, [visible]);

  const doExport = async () => {
    const entries = Object.values(useTrackingStore.getState().entries);
    if (entries.length === 0) {
      setError('Your library is empty — nothing to back up yet. Track a few titles first.');
      setPhase('error');
      return;
    }
    setPhase('exporting');
    const name = backupFileName();
    const res = await saveTextFile(name, entriesToXml(entries), BACKUP_MIME);
    if (res === 'error' || res === 'unsupported') {
      setError(
        res === 'unsupported'
          ? "This device can't save files automatically. Try the app on another device."
          : "Couldn't save the backup file. Please try again.",
      );
      setPhase('error');
      return;
    }
    setFileName(name);
    setExportedCount(entries.length);
    setResult(res);
    setPhase('exported');
  };

  const pickAndParse = async () => {
    let asset: DocumentPicker.DocumentPickerAsset;
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return; // backed out — stay on home
      asset = res.assets[0];
    } catch {
      setError("Couldn't open the file picker. Try again.");
      setPhase('error');
      return;
    }

    setPhase('restoreLoading');
    try {
      const list = parseLibraryXml(await readPickedText(asset));
      if (list.length === 0) {
        setError(
          "That file doesn't look like a Senpai backup. Pick the senpai-library-….xml file you exported.",
        );
        setPhase('error');
        return;
      }
      setParsed(list);
      setPhase('restoreReview');
    } catch {
      setError("Couldn't read that file. Make sure it's a Senpai backup .xml file.");
      setPhase('error');
    }
  };

  const applyRestore = (mode: ImportMode) => {
    setSummary(restoreEntries(parsed, mode));
    setPhase('restoreDone');
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text variant="caption" color="textFaint" uppercase>
        Back up & restore
      </Text>

      {phase === 'home' && (
        <>
          <Text variant="heading" style={styles.title}>
            Keep your library safe
          </Text>
          <Text variant="callout" color="textMuted" style={styles.body}>
            Your list is saved on this device. Until accounts arrive, export a backup file to keep it
            safe across reinstalls or a new phone — then restore it here anytime.
          </Text>
          <Button
            label={trackedCount > 0 ? `Export backup (${trackedCount} ${trackedCount === 1 ? 'title' : 'titles'})` : 'Export backup'}
            fullWidth
            onPress={doExport}
            style={styles.action}
          />
          <Button
            label="Restore from a backup file"
            fullWidth
            variant="ghost"
            onPress={pickAndParse}
            style={styles.actionGhost}
          />
        </>
      )}

      {(phase === 'exporting' || phase === 'restoreLoading') && (
        <>
          <Text variant="heading" style={styles.title}>
            {phase === 'exporting' ? 'Preparing backup…' : 'Reading backup…'}
          </Text>
          <Text variant="callout" color="textMuted" style={styles.body}>
            {phase === 'exporting' ? 'Packing up your library.' : 'Parsing the file.'}
          </Text>
          <View style={[styles.track, { backgroundColor: colors.surfaceHigh }]}>
            <View style={[styles.fill, { backgroundColor: colors.accent, width: '40%' }]} />
          </View>
        </>
      )}

      {phase === 'exported' && (
        <>
          <View style={styles.doneHead}>
            <Ionicons name="checkmark-circle" size={22} color={colors.positive} />
            <Text variant="heading">Backup ready</Text>
          </View>
          <Text variant="callout" color="textMuted" style={styles.body}>
            {exportedCount} {exportedCount === 1 ? 'title' : 'titles'} exported.{' '}
            {result === 'downloaded'
              ? `Saved as ${fileName}.`
              : 'Saved via the share sheet — keep it somewhere safe like Files or your cloud drive.'}
          </Text>
          <Button label="Done" fullWidth onPress={onClose} style={styles.action} />
        </>
      )}

      {phase === 'restoreReview' && (
        <>
          <Text variant="heading" style={styles.title}>
            Found {parsed.length} {parsed.length === 1 ? 'title' : 'titles'}
          </Text>
          <Text variant="callout" color="textMuted" style={styles.body}>
            {trackedCount === 0
              ? 'Add them to your library.'
              : `Merge keeps your newer changes per title. Replace swaps your current ${trackedCount} ${trackedCount === 1 ? 'title' : 'titles'} for this backup.`}
          </Text>
          <Button
            label={trackedCount === 0 ? `Restore ${parsed.length}` : 'Merge into my list'}
            fullWidth
            onPress={() => applyRestore('merge')}
            style={styles.action}
          />
          {trackedCount > 0 && (
            <Button
              label="Replace my list"
              fullWidth
              variant="ghost"
              onPress={() => applyRestore('replace')}
              style={styles.actionGhost}
            />
          )}
        </>
      )}

      {phase === 'restoreDone' && summary && (
        <>
          <View style={styles.doneHead}>
            <Ionicons name="checkmark-circle" size={22} color={colors.positive} />
            <Text variant="heading">Restore complete</Text>
          </View>
          <Text variant="callout" color="textMuted" style={styles.body}>
            {summary.added} added · {summary.updated} updated · {summary.unchanged} unchanged
          </Text>
          <Button label="Done" fullWidth onPress={onClose} style={styles.action} />
        </>
      )}

      {phase === 'error' && (
        <>
          <Text variant="heading" style={styles.title}>
            Something went wrong
          </Text>
          <Text variant="callout" color="textMuted" style={styles.body}>
            {error}
          </Text>
          <Button label="Back" fullWidth onPress={() => setPhase('home')} style={styles.action} />
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
});
