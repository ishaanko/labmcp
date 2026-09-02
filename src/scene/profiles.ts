import type { ContainerType } from "@/engine";

/**
 * Lathe profiles for the glassware (Appendix C3.5). Each point is `(r, y)` in the same
 * convention three.js `LatheGeometry` takes, so `profile.points` can be fed straight into a
 * lathe's `Vector2` list. Volume is calibrated per profile so that `heightForVolume(capacityMl)`
 * lands exactly on `capacityHeight`, whatever the profile's own unit scale turns out to be.
 */
export interface ProfilePoint {
  readonly r: number;
  readonly y: number;
}

export interface LatheProfile {
  readonly points: ReadonlyArray<ProfilePoint>;
  readonly capacityMl: number;
  readonly capacityHeight: number;
  /** Cumulative cross-sectional volume (arbitrary units) at `SLICES + 1` evenly spaced heights. */
  readonly cumulativeVolume: ReadonlyArray<number>;
  /** Arbitrary volume units per mL, so `heightForVolume` can target physical volumes. */
  readonly unitsPerMl: number;
}

const SLICES = 64;

function radiusAtPoints(points: ReadonlyArray<ProfilePoint>, y: number): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return 0;
  if (y <= first.y) return first.r;
  if (y >= last.y) return last.r;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    if (y >= a.y && y <= b.y) {
      const t = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
      return a.r + (b.r - a.r) * t;
    }
  }
  return last.r;
}

/** Radius of the glass wall at height `y` (world units, clamped to the profile's range). */
export function radiusAt(profile: LatheProfile, y: number): number {
  return radiusAtPoints(profile.points, y);
}

/**
 * Widest radius near the base (bottom 15% of the profile's height), for the contact-shadow
 * disc under a vessel. Sampling near the base rather than at `y=0` matters for the Erlenmeyer:
 * its widest point is its shoulder just above the floor, not the floor itself.
 */
export function footprintRadius(profile: LatheProfile): number {
  const threshold = profile.capacityHeight * 0.15;
  let r = 0;
  for (const p of profile.points) {
    if (p.y <= threshold) r = Math.max(r, p.r);
  }
  return r;
}

/** Builds a calibrated profile from raw lathe points and the vessel's nominal capacity. */
export function makeProfile(points: ReadonlyArray<ProfilePoint>, capacityMl: number): LatheProfile {
  const last = points[points.length - 1];
  const capacityHeight = last ? last.y : 0;
  const step = capacityHeight / SLICES;
  const cumulativeVolume: number[] = [0];
  let acc = 0;
  for (let i = 1; i <= SLICES; i++) {
    const rPrev = radiusAtPoints(points, (i - 1) * step);
    const rCur = radiusAtPoints(points, i * step);
    acc += ((Math.PI * rPrev * rPrev + Math.PI * rCur * rCur) / 2) * step;
    cumulativeVolume.push(acc);
  }
  const totalVolumeUnits = cumulativeVolume[SLICES] ?? acc;
  const unitsPerMl = capacityMl > 0 ? totalVolumeUnits / capacityMl : 1;
  return { points, capacityMl, capacityHeight, cumulativeVolume, unitsPerMl };
}

/**
 * Height at which the profile holds `volumeMl`, via the profile's precomputed 64-slice
 * cumulative volume. `heightForVolume(capacityMl)` returns `capacityHeight` exactly, because
 * `unitsPerMl` was calibrated from that same integration.
 */
export function heightForVolume(profile: LatheProfile, volumeMl: number): number {
  const { cumulativeVolume, capacityHeight, unitsPerMl } = profile;
  const targetUnits = Math.max(0, volumeMl) * unitsPerMl;
  if (targetUnits <= 0) return 0;
  const totalUnits = cumulativeVolume[SLICES] ?? 0;
  if (targetUnits >= totalUnits) return capacityHeight;

  let lo = 0;
  let hi = SLICES;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const v = cumulativeVolume[mid] ?? 0;
    if (v < targetUnits) lo = mid + 1;
    else hi = mid;
  }
  const idx = Math.max(1, lo);
  const vLow = cumulativeVolume[idx - 1] ?? 0;
  const vHigh = cumulativeVolume[idx] ?? vLow;
  const step = capacityHeight / SLICES;
  const t = vHigh > vLow ? (targetUnits - vLow) / (vHigh - vLow) : 0;
  return (idx - 1) * step + t * step;
}

/** Shifts every radius inward by `wall`, for the liquid body that sits inside the glass. */
export function innerProfile(profile: LatheProfile, wall: number): LatheProfile {
  const points = profile.points.map((p) => ({ r: Math.max(0, p.r - wall), y: p.y }));
  return makeProfile(points, profile.capacityMl);
}

function quarterCircle(radius: number, segments: number): ProfilePoint[] {
  const points: ProfilePoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = ((Math.PI / 2) * i) / segments;
    points.push({ r: radius * Math.sin(theta), y: radius * (1 - Math.cos(theta)) });
  }
  return points;
}

export const BEAKER_PROFILE = makeProfile(
  [
    { r: 0, y: 0 },
    { r: 0.34, y: 0 },
    { r: 0.36, y: 0.02 },
    { r: 0.36, y: 0.9 },
    { r: 0.385, y: 0.95 },
  ],
  250,
);

export const ERLENMEYER_PROFILE = makeProfile(
  [
    { r: 0, y: 0 },
    { r: 0.4, y: 0 },
    { r: 0.42, y: 0.03 },
    { r: 0.13, y: 0.72 },
    { r: 0.13, y: 0.92 },
    { r: 0.15, y: 0.95 },
  ],
  250,
);

export const TEST_TUBE_PROFILE = makeProfile(
  [...quarterCircle(0.09, 6), { r: 0.09, y: 0.7 }, { r: 0.1, y: 0.74 }],
  20,
);

export const GRAD_CYLINDER_PROFILE = makeProfile(
  [
    { r: 0, y: 0 },
    { r: 0.13, y: 0 },
    { r: 0.13, y: 1.25 },
    { r: 0.15, y: 1.3 },
  ],
  100,
);

export const BURETTE_PROFILE = makeProfile(
  [
    { r: 0, y: 0 },
    { r: 0.07, y: 0 },
    { r: 0.07, y: 2.0 },
    { r: 0.08, y: 2.05 },
  ],
  50,
);

const PROFILE_BY_TYPE: Readonly<Record<ContainerType, LatheProfile>> = {
  beaker: BEAKER_PROFILE,
  flask: ERLENMEYER_PROFILE,
  test_tube: TEST_TUBE_PROFILE,
  graduated_cylinder: GRAD_CYLINDER_PROFILE,
  burette: BURETTE_PROFILE,
};

export function profileForContainerType(type: ContainerType): LatheProfile {
  return PROFILE_BY_TYPE[type];
}
