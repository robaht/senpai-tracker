import { ReactNode, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, View, StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion, spacing, makeStyles, useMotion, useTheme } from '../../theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * App-wide bottom sheet. The two layers animate independently — the scrim
 * *fades* while the card *slides* up — which reads naturally; letting the native
 * Modal slide transition move the whole thing drags the scrim with the card
 * (an unnatural dark rectangle sweeping in/out), so we hand-drive it with
 * `animationType="none"`.
 *
 * We stay mounted through the exit (`mounted`) and only run the *close*
 * transition once the sheet has actually opened (`wasOpen`) — otherwise the
 * hidden initial mount schedules a close whose completion callback races ahead
 * and unmounts the card just as it opens (cancellation isn't reliable on web).
 *
 * Callers that derive their content from data which can vanish on close (e.g. a
 * selected item reset to null by `onClose`) should latch the last value so the
 * children don't blank out mid-animation.
 */
export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors, retro } = useTheme();
  const { reduced } = useMotion();
  const styles = useStyles();

  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  const sheetH = useSharedValue(600);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (visible) {
      wasOpen.current = true;
      setMounted(true);
      // Open with the iOS drawer curve; close faster than it opens (exits should
      // never linger). Both layers share this progress value.
      progress.value = withTiming(1, {
        duration: motion.duration.slow,
        easing: motion.easing.drawer,
      });
    } else if (wasOpen.current) {
      wasOpen.current = false;
      progress.value = withTiming(
        0,
        { duration: motion.duration.exit, easing: motion.easing.out },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        },
      );
    }
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  // Under reduced motion the card fades with the scrim instead of sliding.
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: reduced ? progress.value : 1,
    transform: [{ translateY: reduced ? 0 : (1 - progress.value) * sheetH.value }],
  }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <AnimatedPressable style={[styles.backdrop, backdropStyle]} onPress={onClose} />
        <Animated.View
          onLayout={(e) => {
            sheetH.value = e.nativeEvent.layout.height;
          }}
          style={[
            styles.sheet,
            retro && styles.sheetRetro,
            sheetStyle,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderStrong,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ radii }) => ({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Retro: a hard dialog-box edge — thick navy border on three sides.
  sheetRetro: {
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.lg,
  },
}));
