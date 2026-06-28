/**
 * Reduced-motion-aware access to the motion tokens.
 *
 * `reduced` reflects the OS "reduce motion" setting (and `prefers-reduced-motion`
 * on web). Reduced means *gentler*, not *off*: keep opacity/color transitions that
 * aid comprehension, drop position/scale movement. Call sites read `reduced` and
 * skip transforms accordingly.
 */
import { useReducedMotion } from 'react-native-reanimated';
import { motion } from './motion';

export function useMotion() {
  const reduced = useReducedMotion();
  return { reduced, ...motion };
}
