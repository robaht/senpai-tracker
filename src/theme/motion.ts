/**
 * Motion tokens — the single source of truth for timing, easing and springs.
 *
 * Like spacing/radii/typography these are theme-invariant: motion feels the same
 * in every theme. Import them statically anywhere. Colors still come from
 * `useTheme()`; *timing* lives here.
 *
 * The curves are intentionally stronger than the CSS/Reanimated built-ins —
 * `Easing.out(Easing.cubic)` is too weak to feel deliberate. We never use an
 * ease-*in* curve on UI: it delays the first frame, the exact moment the user is
 * watching, which reads as sluggish. Entrances and presses are ease-out; on-screen
 * movement is ease-in-out; drawers get the iOS sheet curve.
 */
import { Easing } from 'react-native-reanimated';

export const motion = {
  /** Cubic-bezier easing factories (pass straight to `withTiming({ easing })`). */
  easing: {
    /** Strong ease-out — entrances, press feedback, most UI. */
    out: Easing.bezier(0.23, 1, 0.32, 1),
    /** Strong ease-in-out — elements moving/morphing on screen. */
    inOut: Easing.bezier(0.77, 0, 0.175, 1),
    /** iOS drawer curve (Ionic) — bottom sheets sliding up. */
    drawer: Easing.bezier(0.32, 0.72, 0, 1),
  },

  /**
   * Duration scale (ms). UI animations stay under 300ms — a 220ms transition
   * feels more responsive than a 400ms one. Exits run faster than enters.
   */
  duration: {
    press: 120, // scale-down on touch
    pressOut: 160, // release back to rest
    fast: 160, // tooltips, tiny popovers, number ticks
    base: 220, // the default for most transitions
    slow: 280, // sheet/drawer open
    exit: 180, // generic exit — faster than its enter
    stagger: 50, // delay between staggered siblings (keep 30–80ms)
  },

  /**
   * Spring presets (Reanimated `withSpring` configs) — for interruptible,
   * gesture-driven, or "alive" motion only. Springs keep velocity when
   * interrupted; duration-based timing restarts from zero. Keep bounce subtle.
   */
  spring: {
    /** Calm snap-back (drag dismissal return, drawer settle). */
    gentle: { mass: 1, damping: 20, stiffness: 180 },
    /** Quicker, slightly livelier (interactive toggles). */
    snappy: { mass: 1, damping: 16, stiffness: 260 },
  },
} as const;

export type Motion = typeof motion;
