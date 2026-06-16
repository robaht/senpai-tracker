import { useEffect, useState } from 'react';
import { View, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, useTheme } from '../theme';
import { Text } from './ui/Text';
import { Button } from './ui/Button';
import { BottomSheet } from './ui/BottomSheet';
import { getUserAnimeList, type ImportedListEntry } from '../api/anilist';
import { useTrackingStore, type ImportMode, type ImportSummary } from '../features/tracking/store';

interface ImportFromAniListSheetProps {
  visible: boolean;
  onClose: () => void;
}

type Phase = 'input' | 'loading' | 'found' | 'done' | 'error';

/**
 * Import a public AniList user's anime list by username. No auth — public
 * profiles only. Flow: enter username → fetch → choose Merge or Replace → summary.
 */
export function ImportFromAniListSheet({ visible, onClose }: ImportFromAniListSheetProps) {
  const { colors } = useTheme();
  const importFromList = useTrackingStore((s) => s.importFromList);
  const trackedCount = useTrackingStore((s) => Object.keys(s.entries).length);

  const [username, setUsername] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [list, setList] = useState<ImportedListEntry[]>([]);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  // Fresh start each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setUsername('');
      setPhase('input');
      setList([]);
      setError('');
      setSummary(null);
    }
  }, [visible]);

  const fetchList = async () => {
    const name = username.trim();
    if (!name) return;
    setPhase('loading');
    setError('');
    try {
      const result = await getUserAnimeList(name);
      if (result.length === 0) {
        setError(`No anime on ${name}'s list — double-check the username, or the profile may be private.`);
        setPhase('error');
        return;
      }
      setList(result);
      setPhase('found');
    } catch {
      setError(`Couldn't find “${name}” on AniList. Check the spelling — and that the list is public.`);
      setPhase('error');
    }
  };

  const apply = (mode: ImportMode) => {
    setSummary(importFromList(list, mode));
    setPhase('done');
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text variant="caption" color="textFaint" uppercase>
        Import from AniList
      </Text>

      {(phase === 'input' || phase === 'loading') && (
        <>
          <Text variant="heading" style={styles.title}>
            Bring in your list
          </Text>
          <Text variant="callout" color="textMuted" style={styles.body}>
            Enter a public AniList username to import its anime list — status, progress and scores.
          </Text>
          <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="person-outline" size={18} color={colors.textFaint} />
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="AniList username"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              editable={phase !== 'loading'}
              onSubmitEditing={fetchList}
              returnKeyType="search"
              style={[styles.input, { color: colors.text }]}
            />
          </View>
          <Button
            label={phase === 'loading' ? 'Fetching…' : 'Find list'}
            fullWidth
            loading={phase === 'loading'}
            disabled={username.trim().length === 0}
            onPress={fetchList}
            style={styles.action}
          />
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
            Found {list.length} {list.length === 1 ? 'title' : 'titles'}
          </Text>
          <Text variant="callout" color="textMuted" style={styles.body}>
            {trackedCount === 0
              ? 'Add them to your library.'
              : `Merge keeps your newer changes per title. Replace swaps your current ${trackedCount} ${trackedCount === 1 ? 'title' : 'titles'} for this list.`}
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
          </Text>
          <Button label="Done" fullWidth onPress={onClose} style={styles.action} />
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 2, marginBottom: spacing.sm },
  body: { marginBottom: spacing.lg },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    fontFamily: 'Jakarta_500',
    fontSize: 15,
  },
  action: { marginTop: spacing.lg },
  actionGhost: { marginTop: spacing.xs },
  doneHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
});
