import type { ContainerType } from "@/engine";

/** Vessel types with a bottom-anchored liquid cavity, drawn in their own per-type viewBox. */
export type RectVesselType = Exclude<ContainerType, "burette">;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Volume as a 0..1 fraction of capacity. Clamps out-of-range input instead of throwing. */
export function fillFraction(volumeMl: number, capacityMl: number): number {
  if (capacityMl <= 0) return 0;
  return clamp01(volumeMl / capacityMl);
}

/**
 * Static shape of a vessel's inner cavity, in that vessel's own viewBox: a bounding box for the
 * liquid rect, plus the polygon that clips it to the vessel's true silhouette (beakers are
 * near-cylindrical, flasks taper to a neck, tubes and cylinders are narrow columns).
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

/**
 * Beaker and flask sit at 108x130, the tube at 40x120, and the cylinder at 56x150 (art
 * direction's rest sizes). Each vessel's own component draws in a viewBox matching these
 * dimensions 1:1, so its default rendered size needs no extra scaling.
 */
export const VESSEL_GEOMETRY: Readonly<Record<RectVesselType, VesselGeometry>> = {
  beaker: { left: 8, right: 100, bottomY: 120, topY: 20, clipPoints: "8,120 8,20 100,20 100,120" },
  flask: { left: 20, right: 88, bottomY: 116, topY: 46, clipPoints: "22,116 88,116 62,44 46,44" },
  test_tube: {
    left: 6,
    right: 34,
    bottomY: 108,
    topY: 16,
    clipPoints: "6,96 6,16 34,16 34,96 32,104 26,108 14,108 8,104",
  },
  graduated_cylinder: { left: 10, right: 46, bottomY: 140, topY: 22, clipPoints: "10,140 10,22 46,22 46,140" },
};

/** The burette's own tall geometry, in its 44x240 viewBox. */
export const BURETTE_GEOMETRY: VesselGeometry = {
  left: 14,
  right: 30,
  bottomY: 214,
  topY: 20,
  clipPoints: "14,214 14,20 30,20 30,214",
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

/**
 * Drawn-fraction floor for rect vessels: a realistic 10% fill is a 7px strip, so any liquid
 * shows at least this much of the cavity and the rest scales into what remains. The burette is
 * exempt; its graduations must stay true.
 */
export const RECT_FILL_FLOOR = 0.16;

/** Bottom-anchored liquid rect for beakers, flasks, tubes, and cylinders. */
export function liquidRect(type: RectVesselType, volumeMl: number, capacityMl: number): LiquidRect {
  const fraction = fillFraction(volumeMl, capacityMl);
  return rectFromGeometry(VESSEL_GEOMETRY[type], fraction > 0 ? RECT_FILL_FLOOR + (1 - RECT_FILL_FLOOR) * fraction : 0);
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

/**
 * Declared SVG viewBox size for every container type. Each vessel component draws 1:1 inside this
 * box (its rendered `size` prop equals `width`, height follows from the same scale), so this is
 * also that vessel's on-screen footprint with no extra scaling to account for.
 */
export const VESSEL_VIEWBOX: Readonly<Record<ContainerType, { width: number; height: number }>> = {
  beaker: { width: 108, height: 130 },
  flask: { width: 108, height: 130 },
  test_tube: { width: 40, height: 120 },
  graduated_cylinder: { width: 56, height: 150 },
  burette: { width: 44, height: 240 },
};

function geometryFor(type: ContainerType): VesselGeometry {
  if (type === "burette") return BURETTE_GEOMETRY;
  return VESSEL_GEOMETRY[type];
}

/** y (in the vessel's own viewBox units) of the liquid surface: the top edge of its fill rect. */
export function liquidSurfaceY(type: ContainerType, volumeMl: number, capacityMl: number): number {
  if (type === "burette") return buretteFill(volumeMl, capacityMl).y;
  return liquidRect(type, volumeMl, capacityMl).y;
}

/** y (in the vessel's own viewBox units) of the cavity floor, where an empty vessel's fill bottoms out. */
export function vesselFloorY(type: ContainerType): number {
  return geometryFor(type).bottomY;
}

interface ParsedColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/** Parses a CSS `rgb()`/`rgba()` color string. Null for anything else, so callers can fall through. */
function parseColor(color: string): ParsedColor | null {
  const match = /^rgba?\(([^)]+)\)$/.exec(color.trim());
  if (!match || !match[1]) return null;
  const parts = match[1].split(",").map((p) => p.trim());
  const [r, g, b] = parts;
  if (r === undefined || g === undefined || b === undefined) return null;
  const parsedAlpha = parts[3] !== undefined ? Number.parseFloat(parts[3]) : 1;
  const alpha = Number.isFinite(parsedAlpha) ? parsedAlpha : 1;
  return { r: Number.parseFloat(r), g: Number.parseFloat(g), b: Number.parseFloat(b), a: alpha };
}

/** Parses a CSS `rgb()`/`rgba()` color and floors its alpha channel so liquids read on black. */
export function clampAlpha(color: string, minAlpha: number): string {
  const parsed = parseColor(color);
  if (!parsed) return color;
  const alpha = Math.max(minAlpha, parsed.a);
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
}

/** Blends a CSS `rgb()`/`rgba()` color toward white by `amount` (0..1), keeping its own alpha. */
export function mixWithWhite(color: string, amount: number): string {
  const parsed = parseColor(color);
  if (!parsed) return color;
  const t = clamp01(amount);
  const r = Math.round(parsed.r + (255 - parsed.r) * t);
  const g = Math.round(parsed.g + (255 - parsed.g) * t);
  const b = Math.round(parsed.b + (255 - parsed.b) * t);
  return `rgba(${r}, ${g}, ${b}, ${parsed.a})`;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case rn:
      h = (gn - bn) / d + (gn < bn ? 6 : 0);
      break;
    case gn:
      h = (bn - rn) / d + 2;
      break;
    default:
      h = (rn - gn) / d + 4;
  }
  return { h: h / 6, s, l };
}

function hueToRgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  };
}

/** The phenolphthalein endpoint pink, held fixed instead of run through the vibrancy curve. */
const PINK_ENDPOINT = { r: 242, g: 111, b: 176 };
const PINK_TOLERANCE = 6;

function isPinkEndpoint(c: ParsedColor): boolean {
  return Math.abs(c.r - PINK_ENDPOINT.r) <= PINK_TOLERANCE && Math.abs(c.g - PINK_ENDPOINT.g) <= PINK_TOLERANCE && Math.abs(c.b - PINK_ENDPOINT.b) <= PINK_TOLERANCE;
}

/**
 * Re-maps the engine's derived liquid color for the flat, saturated look the art direction wants:
 * alpha floored at 0.85, saturation boosted 1.35x, lightness clamped to 0.55-0.7. The
 * phenolphthalein endpoint pink is exempt, so it stays exactly `#f26fb0`.
 */
export function vibrant(color: string): string {
  const parsed = parseColor(color);
  if (!parsed) return color;
  const alpha = Math.max(parsed.a, 0.85);
  if (isPinkEndpoint(parsed)) return `rgba(${PINK_ENDPOINT.r}, ${PINK_ENDPOINT.g}, ${PINK_ENDPOINT.b}, ${alpha})`;
  const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b);
  const s = clamp01(hsl.s * 1.35);
  const l = Math.min(0.7, Math.max(0.55, hsl.l));
  const rgb = hslToRgb(hsl.h, s, l);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}
