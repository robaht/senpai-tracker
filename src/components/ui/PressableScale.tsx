import { ReactNode } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { motion, useMotion } from '../../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends PressableProps {
  children: ReactNode;
  /** How far to scale down on press. Default 0.96. */
  activeScale?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Pressable with a subtle scale-in on touch — the small tactile detail that makes
 * the whole app feel responsive and premium. Used for every card and button so
 * press feedback is consistent everywhere. The press uses the shared ease-out
 * curve (the default linear timing felt mechanical) and releases a touch slower
 * than it presses. Honors reduced motion by holding still.
 */
export function PressableScale({
  children,
  activeScale = 0.96,
  style,
  ...rest
}: PressableScaleProps) {
  const { reduced } = useMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        if (reduced) return;
        scale.value = withTiming(activeScale, {
          duration: motion.duration.press,
          easing: motion.easing.out,
        });
      }}
      onPressOut={() => {
        if (reduced) return;
        scale.value = withTiming(1, {
          duration: motion.duration.pressOut,
          easing: motion.easing.out,
        });
      }}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
