import { damp } from "maath/easing";

/**
 * Shared damping constants (Appendix C1, C3.6, C3.8). Every number here is a maath
 * `smoothTime` in seconds: roughly the time to close ~95% of the remaining distance.
 * `reduced` replaces all of them under `prefers-reduced-motion` so every job reads as a
 * ~150ms snap instead of its normal settle.
 */
export const SMOOTH_TIME = {
  /** Position/tilt/fill chase (C1 `damp.snap`). */
  snap: 0.14,
  /** Extra per-frame fill smoothing on top of the already-damped volume (C3.6). */
  fillLocal: 0.12,
  /** Liquid color (C3.8); ~3x this is the "800ms beat" an indicator crossing reads as. */
  color: 0.25,
  /** Temperature/glow/steam (C1 `damp.slow`). */
  temperature: 0.4,
  precipitateAmount: 0.13,
  precipitateSettle: 0.83,
  bubble: 0.1,
  stir: 0.17,
  opacity: 0.07,
  /** Agent ring: fast in, slow out (C6: ~120ms in, ~380ms out). */
  ringIn: 0.04,
  ringOut: 0.13,
  reduced: 0.05,
} as const;

/** `dt` is always clamped before use so a stalled tab doesn't fling anything on resume. */
export function clampDt(dt: number): number {
  return Math.min(Math.max(dt, 0), 1 / 30);
}

/**
 * Damps a numeric field on a plain object toward `target` in place, wrapping maath's `damp`.
 * `current` is any object with a numeric field named `key` (`VisualState` and friends all
 * qualify); this lets the driver damp arbitrary fields without a Vector3/Color wrapper.
 */
export function dampValue<K extends string>(
  current: Record<K, number>,
  key: K,
  target: number,
  smoothTime: number,
  dt: number,
): void {
  damp(current, key, target, smoothTime, clampDt(dt));
}
