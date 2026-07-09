import { useMemo, useState } from 'react';
import { View, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGoBack } from '../src/lib/useGoBack';
import { Screen } from '../src/components/ui/Screen';
import { Text } from '../src/components/ui/Text';
import { NotificationRow } from '../src/components/NotificationRow';
import { EmptyState } from '../src/components/EmptyState';
import { useNotificationStore, useUnreadCount } from '../src/features/notifications/store';
import { runNotificationDetection } from '../src/features/notifications/detect';
import { spacing, makeStyles, useTheme } from '../src/theme';

export default function NotificationsScreen() {
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();

  const entries = useNotificationStore((s) => s.entries);
  const hydrated = useNotificationStore((s) => s.hydrated);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const unreadCount = useUnreadCount();

  const [refreshing, setRefreshing] = useState(false);

  const list = useMemo(
    () => Object.values(entries).sort((a, b) => b.createdAt - a.createdAt),
    [entries],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await runNotificationDetection({ force: true });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={goBack}
          hitSlop={8}
          style={[styles.backBtn, { backgroundColor: colors.surfaceHigh }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text variant="title" style={styles.title}>
          Notifications
        </Text>
        {unreadCount > 0 && (
          <Pressable
            onPress={markAllRead}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Mark all read"
          >
            <Text variant="callout" color={colors.accent}>
              Mark all read
            </Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <NotificationRow notification={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListEmptyComponent={
          hydrated && list.length === 0 ? (
            <EmptyState
              emoji="🔔"
              title="You're all caught up"
              subtitle="New episodes and seasons for your list will show up here."
            />
          ) : null
        }
      />
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
  title: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['4xl'],
    flexGrow: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
}));
