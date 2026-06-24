import { Pressable, View, StyleSheet } from 'react-native';
import { radii, spacing, useTheme } from '../theme';
import { Text } from './ui/Text';
import { withAlpha } from './ui/Badge';
import { BottomSheet } from './ui/BottomSheet';
import { displayTitle, type Media } from '../api/anilist';
import { STATUS_META, WATCH_STATUSES, statusColor, type WatchStatus } from '../features/tracking/types';
import { premiereFromMedia, useTrackEntry, useTrackingStore } from '../features/tracking/store';
import { premiereLabel } from '../lib/format';

interface AddToListSheetProps {
  media: Media | null;
  visible: boolean;
  onClose: () => void;
}

/** Bottom-sheet status picker for adding / moving / removing an anime. */
export function AddToListSheet({ media, visible, onClose }: AddToListSheetProps) {
  const { colors } = useTheme();
  const entry = useTrackEntry(media?.id ?? -1);
  const track = useTrackingStore((s) => s.track);
  const untrack = useTrackingStore((s) => s.untrack);

  const choose = (status: WatchStatus) => {
    if (!media) return;
    track(media, status);
    onClose();
  };

  const premiereAt = media ? premiereFromMedia(media) : null;
  const premiere = premiereAt != null ? premiereLabel(premiereAt) : null;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {media && (
        <>
          <Text variant="caption" color="textFaint" uppercase>
            Add to list
          </Text>
          <Text variant="heading" numberOfLines={1} style={premiere ? undefined : styles.title}>
            {displayTitle(media.title)}
          </Text>
          {premiere && (
            <Text variant="callout" color={colors.info} style={styles.premiere}>
              {premiere}
            </Text>
          )}

          <View style={styles.options}>
            {WATCH_STATUSES.map((status) => {
              const meta = STATUS_META[status];
              const color = statusColor(colors, status);
              const active = entry?.status === status;
              return (
                <Pressable
                  key={status}
                  onPress={() => choose(status)}
                  style={[
                    styles.option,
                    { borderColor: active ? color : colors.border },
                    active && { backgroundColor: withAlpha(color, 0.14) },
                  ]}
                >
                  <View style={[styles.optionDot, { backgroundColor: color }]} />
                  <Text variant="bodyMedium" color={active ? colors.text : colors.textMuted}>
                    {meta.label}
                  </Text>
                  {active && (
                    <Text variant="callout" color={color} style={styles.check}>
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
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  premiere: {
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
