import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { View, StyleSheet } from 'react-native';
import { formatDistanceToNowStrict } from 'date-fns';
import { spacing, makeStyles, useTheme } from '../theme';
import { Text } from './ui/Text';
import { PressableScale } from './ui/PressableScale';
import { useNotificationStore } from '../features/notifications/store';
import type { AppNotification } from '../features/notifications/types';

interface NotificationRowProps {
  notification: AppNotification;
}

/**
 * One row in the notification center: poster thumbnail + message + relative
 * time, with an unread dot. Tapping marks it read and navigates — to the
 * source title for `new-episode`, to the announced sequel for `new-season`.
 */
export function NotificationRow({ notification }: NotificationRowProps) {
  const router = useRouter();
  const { colors, retro } = useTheme();
  const styles = useStyles();
  const markRead = useNotificationStore((s) => s.markRead);

  const onPress = () => {
    if (!notification.read) markRead(notification.id);
    if (notification.type === 'new-episode') {
      router.push(`/anime/${notification.mediaId}`);
    } else {
      router.push(`/anime/${notification.sequelMediaId}`);
    }
  };

  return (
    <PressableScale
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={notification.message}
    >
      <View style={styles.unreadDotSlot}>
        {!notification.read && <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />}
      </View>
      <View
        style={[
          styles.posterWrap,
          retro && styles.posterWrapRetro,
          { backgroundColor: colors.surface, borderColor: retro ? colors.borderStrong : colors.border },
        ]}
      >
        <Image source={notification.coverImage} style={styles.poster} contentFit="cover" transition={220} />
      </View>
      <View style={styles.textCol}>
        <Text variant="callout" numberOfLines={1}>
          {notification.title}
        </Text>
        <Text variant="callout" color="textMuted" numberOfLines={2}>
          {notification.message}
        </Text>
        <Text variant="caption" color="textFaint">
          {formatDistanceToNowStrict(notification.createdAt, { addSuffix: true })}
        </Text>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ radii }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  unreadDotSlot: {
    width: 8,
    alignItems: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  posterWrap: {
    width: 48,
    height: 68,
    borderRadius: radii.sm,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  posterWrapRetro: {
    borderWidth: 2,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
}));
