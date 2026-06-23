import { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { radii, spacing, useTheme } from '../theme';
import { withAlpha } from './ui/Badge';
import { Text } from './ui/Text';
import { useAuthStore } from '../features/auth/store';
import { signInWithAniList } from '../features/auth/anilistAuth';
import { pullAndReconcile } from '../features/tracking/sync';
import { useSyncStore } from '../features/tracking/syncStore';

/**
 * AniList account row in Settings (F1). Signed out → "Log in with AniList";
 * signed in → avatar + name + sign out. Settings only renders this when auth is
 * configured (`isAuthConfigured`), so an unconfigured build never shows it.
 */
export function AccountCard() {
  const { colors } = useTheme();
  const status = useAuthStore((s) => s.status);
  const viewer = useAuthStore((s) => s.viewer);
  const completeSignIn = useAuthStore((s) => s.completeSignIn);
  const signOut = useAuthStore((s) => s.signOut);
  const syncing = useSyncStore((s) => s.syncing);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);

  const [busy, setBusy] = useState(false);

  const onSignIn = async () => {
    setBusy(true);
    try {
      const token = await signInWithAniList();
      if (token) await completeSignIn(token);
    } finally {
      setBusy(false);
    }
  };

  if (status === 'signedIn' && viewer) {
    const syncLabel = syncing
      ? 'Syncing your list…'
      : lastSyncedAt
        ? `Last synced ${formatDistanceToNow(lastSyncedAt, { addSuffix: true })}`
        : 'Not synced yet';
    return (
      <View style={styles.group}>
        <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {viewer.avatar ? (
            <Image source={{ uri: viewer.avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: withAlpha(colors.accent, 0.16) }]}>
              <Ionicons name="person" size={18} color={colors.accent} />
            </View>
          )}
          <View style={styles.rowText}>
            <Text variant="bodyMedium" numberOfLines={1}>{viewer.name}</Text>
            <Text variant="caption" color="textFaint">Signed in with AniList</Text>
          </View>
          <Pressable
            onPress={signOut}
            hitSlop={8}
            style={[styles.signOut, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text variant="caption" color="textMuted">Sign out</Text>
          </Pressable>
        </View>

        <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.rowIcon, { backgroundColor: withAlpha(colors.accent, 0.16) }]}>
            {syncing ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="sync-outline" size={18} color={colors.accent} />
            )}
          </View>
          <View style={styles.rowText}>
            <Text variant="bodyMedium">List sync</Text>
            <Text variant="caption" color="textFaint">{syncLabel}</Text>
          </View>
          <Pressable
            onPress={() => void pullAndReconcile()}
            disabled={syncing}
            hitSlop={8}
            style={[styles.signOut, { borderColor: colors.border, opacity: syncing ? 0.5 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Sync now"
          >
            <Text variant="caption" color={syncing ? undefined : colors.accent}>Sync now</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const disabled = busy;
  return (
    <Pressable
      onPress={onSignIn}
      disabled={disabled}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, opacity: disabled ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel="Log in with AniList"
    >
      <View style={[styles.rowIcon, { backgroundColor: withAlpha(colors.accent, 0.16) }]}>
        {busy ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Ionicons name="log-in-outline" size={18} color={colors.accent} />
        )}
      </View>
      <View style={styles.rowText}>
        <Text variant="bodyMedium">Log in with AniList</Text>
        <Text variant="caption" color="textFaint">Sync your list across devices</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  signOut: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
