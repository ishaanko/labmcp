import type { ContainerType } from "@/engine";

/** Vessel types with a bottom-anchored liquid cavity, drawn in the shared 120x160 viewBox. */
export type RectVesselType = Exclude<ContainerType, "burette">;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Volume as a 0..1 fraction of capacity. Clamps out-of-range input instead of throwing. */
export function fillFraction(volumeMl: number, capacityMl: number): number {
  if (capacityMl <= 0) return 0;
  return clamp01(volumeMl / capacityMl);
}

/**
 * Static shape of a vessel's inner cavity in the 120x160 viewBox: a bounding box for the liquid
 * rect, plus the polygon that clips it to the vessel's true silhouette (beakers are near-cylindrical,
 * flasks taper to a neck, tubes and cylinders are narrow columns).
 */
export interface VesselGeometry {
  readonly left: number;
  readonly right: number;
  /** y of the cavity floor: the liquid rect's fixed bottom edge. */
  readonly bottomY: number;
  /** y of the cavity rim: where the liquid rect's top edge sits at fraction 1. */
  readonly topY: number;
  /** SVG `points` for a `<clipPath>` polygon matching the true cavity silhouette. */
  readonly clipPoints: string;
}

export const VESSEL_GEOMETRY: Readonly<Record<RectVesselType, VesselGeometry>> = {
  beaker: { left: 24, right: 96, bottomY: 138, topY: 38, clipPoints: "24,138 22,40 98,40 96,138" },
  flask: { left: 20, right: 100, bottomY: 140, topY: 46, clipPoints: "22,140 98,140 68,50 52,50" },
  test_tube: {
    left: 44,
    right: 76,
    bottomY: 141,
    topY: 30,
    clipPoints: "44,128 44,30 76,30 76,128 74,138 66,143 54,143 46,138",
  },
  graduated_cylinder: { left: 42, right: 78, bottomY: 144, topY: 20, clipPoints: "42,144 42,20 78,20 78,144" },
};

/** The burette's own tall geometry, in its 120x260 viewBox. */
export const BURETTE_GEOMETRY: VesselGeometry = {
  left: 52,
  right: 68,
  bottomY: 232,
  topY: 24,
  clipPoints: "52,232 52,24 68,24 68,232",
};

export interface LiquidRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function rectFromGeometry(geo: VesselGeometry, fraction: number): LiquidRect {
  const maxHeight = geo.bottomY - geo.topY;
  const height = fraction * maxHeight;
  return { x: geo.left, y: geo.bottomY - height, width: geo.right - geo.left, height };
}

/** Bottom-anchored liquid rect for beakers, flasks, tubes, and cylinders. */
export function liquidRect(type: RectVesselType, volumeMl: number, capacityMl: number): LiquidRect {
  return rectFromGeometry(VESSEL_GEOMETRY[type], fillFraction(volumeMl, capacityMl));
}

/**
 * Burette liquid rect. A burette drains from a tip at the bottom, so the liquid stays anchored
 * there and its surface falls as volume drops, same as every other vessel; the "top-down" part is
 * only how a burette is read (graduations count mL dispensed downward from 0 at the top), not how
 * the fill is drawn. Kept separate from `liquidRect` because the burette has its own geometry.
 */
export function buretteFill(volumeMl: number, capacityMl: number): LiquidRect {
  return rectFromGeometry(BURETTE_GEOMETRY, fillFraction(volumeMl, capacityMl));
}

/** Parses a CSS `rgb()`/`rgba()` color and floors its alpha channel so liquids read on black. */
export function clampAlpha(color: string, minAlpha: number): string {
  const match = /^rgba?\(([^)]+)\)$/.exec(color.trim());
  if (!match || !match[1]) return color;
  const parts = match[1].split(",").map((p) => p.trim());
  const [r, g, b] = parts;
  if (r === undefined || g === undefined || b === undefined) return color;
  const parsedAlpha = parts[3] !== undefined ? Number.parseFloat(parts[3]) : 1;
  const alpha = Math.max(minAlpha, Number.isFinite(parsedAlpha) ? parsedAlpha : 1);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
