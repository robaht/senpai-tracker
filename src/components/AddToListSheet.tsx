import { Modal, Pressable, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '../theme';
import { Text } from './ui/Text';
import { withAlpha } from './ui/Badge';
import { displayTitle, type Media } from '../api/anilist';
import { STATUS_META, WATCH_STATUSES, type WatchStatus } from '../features/tracking/types';
import { useTrackEntry, useTrackingStore } from '../features/tracking/store';

interface AddToListSheetProps {
  media: Media | null;
  visible: boolean;
  onClose: () => void;
}

/** Bottom-sheet status picker for adding / moving / removing an anime. */
export function AddToListSheet({ media, visible, onClose }: AddToListSheetProps) {
  const insets = useSafeAreaInsets();
  const entry = useTrackEntry(media?.id ?? -1);
  const track = useTrackingStore((s) => s.track);
  const untrack = useTrackingStore((s) => s.untrack);

  if (!media) return null;

  const choose = (status: WatchStatus) => {
    track(media, status);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.handle} />
        <Text variant="caption" color="textFaint" uppercase>
          Add to list
        </Text>
        <Text variant="heading" numberOfLines={1} style={styles.title}>
          {displayTitle(media.title)}
        </Text>

        <View style={styles.options}>
          {WATCH_STATUSES.map((status) => {
            const meta = STATUS_META[status];
            const active = entry?.status === status;
            return (
              <Pressable
                key={status}
                onPress={() => choose(status)}
                style={[
                  styles.option,
                  { borderColor: active ? meta.color : colors.border },
                  active && { backgroundColor: withAlpha(meta.color, 0.14) },
                ]}
              >
                <View style={[styles.optionDot, { backgroundColor: meta.color }]} />
                <Text variant="bodyMedium" color={active ? colors.text : colors.textMuted}>
                  {meta.label}
                </Text>
                {active && (
                  <Text variant="callout" color={meta.color} style={styles.check}>
                    ✓
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {entry && (
          <Pressable
            onPress={() => {
              untrack(media.id);
              onClose();
            }}
            style={styles.remove}
          >
            <Text variant="callout" color={colors.danger}>
              Remove from list
            </Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
  title: {
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  optionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  check: {
    marginLeft: 'auto',
  },
  remove: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
});
