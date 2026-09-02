import type { IndicatorId } from "./ids";
import { derivePh } from "./ph";
import { indicatorDef } from "./reagents";
import { getMoles, speciesDef, speciesKeys } from "./species";
import { assertNever, type Container, type IndicatorKind, type Rgba } from "./types";

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

function smoothstep(x: number): number {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

const BASE_TINT: Rgba = { r: 200, g: 225, b: 240, a: 0.12 };

interface Layer {
  readonly rgb: Rgba;
  readonly a: number;
}

/** Liquid color from the base solvent tint plus any species that carry a color (only Cu2+ today). */
export function liquidTint(container: Container): Rgba {
  const layers: Layer[] = [{ rgb: BASE_TINT, a: BASE_TINT.a }];
  for (const id of speciesKeys(container.species)) {
    const def = speciesDef(id);
    if (def.kind !== "aqueous" || def.tint === null) continue;
    const liters = container.volumeMl / 1000;
    if (liters <= 0) continue;
    const concM = getMoles(container.species, id) / liters;
    const a = def.tint.alphaMax * clamp01(concM / def.tint.refM);
    if (a > 0) layers.push({ rgb: def.tint.rgb, a });
  }
  const totalA = 1 - layers.reduce((acc, l) => acc * (1 - l.a), 1);
  const weightSum = layers.reduce((acc, l) => acc + l.a, 0) || 1;
  const r = layers.reduce((acc, l) => acc + l.rgb.r * l.a, 0) / weightSum;
  const g = layers.reduce((acc, l) => acc + l.rgb.g * l.a, 0) / weightSum;
  const b = layers.reduce((acc, l) => acc + l.rgb.b * l.a, 0) / weightSum;
  return { r, g, b, a: totalA };
}

const UNIVERSAL_STOPS: ReadonlyArray<{ readonly pH: number; readonly rgb: Rgba }> = [
  { pH: 1, rgb: { r: 220, g: 40, b: 40, a: 1 } },
  { pH: 4, rgb: { r: 240, g: 120, b: 30, a: 1 } },
  { pH: 6, rgb: { r: 235, g: 210, b: 50, a: 1 } },
  { pH: 7, rgb: { r: 60, g: 170, b: 80, a: 1 } },
  { pH: 9, rgb: { r: 40, g: 110, b: 200, a: 1 } },
  { pH: 11, rgb: { r: 60, g: 50, b: 160, a: 1 } },
  { pH: 13, rgb: { r: 110, g: 30, b: 140, a: 1 } },
];

function universalRgb(pH: number): Rgba {
  const stops = UNIVERSAL_STOPS;
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (first === undefined || last === undefined) throw new Error("unreachable: UNIVERSAL_STOPS is non-empty");
  if (pH <= first.pH) return first.rgb;
  if (pH >= last.pH) return last.rgb;
  for (let i = 0; i < stops.length - 1; i++) {
    const lo = stops[i];
    const hi = stops[i + 1];
    if (!lo || !hi) continue;
    if (pH >= lo.pH && pH <= hi.pH) {
      const t = (pH - lo.pH) / (hi.pH - lo.pH);
      return {
        r: lo.rgb.r + (hi.rgb.r - lo.rgb.r) * t,
        g: lo.rgb.g + (hi.rgb.g - lo.rgb.g) * t,
        b: lo.rgb.b + (hi.rgb.b - lo.rgb.b) * t,
        a: 1,
      };
    }
  }
  return last.rgb;
}

/** The color-response kind of a known indicator id; throws on an id missing from the registry. */
function kindOf(indicator: IndicatorId): IndicatorKind {
  const def = indicatorDef(indicator);
  if (!def) throw new Error(`unreachable: unknown indicator id ${indicator}`);
  return def.kind;
}

/** Which band an indicator currently reads as, for detecting endpoint crossings. */
export function indicatorBand(indicator: IndicatorId, pH: number): number {
  const kind = kindOf(indicator);
  switch (kind) {
    case "phenolphthalein":
      if (pH < 8.2) return 0;
      if (pH <= 10.0) return 1;
      return 2;
    case "universal":
      for (let i = UNIVERSAL_STOPS.length - 1; i >= 0; i--) {
        const stop = UNIVERSAL_STOPS[i];
        if (stop && pH >= stop.pH) return i;
      }
      return 0;
    case "litmus":
      return pH < 7 ? 0 : 1;
    default:
      return assertNever(kind);
  }
}

/** 2 drops fully saturate a 100 mL solution; below that ratio, intensity scales down with concentration. */
const REFERENCE_DROPS_PER_ML = 2 / 100;

function indicatorColor(indicator: IndicatorId, pH: number, drops: number, volumeMl: number): Rgba {
  const doseFactor = volumeMl > 0 ? clamp01(drops / volumeMl / REFERENCE_DROPS_PER_ML) : 0;
  const kind = kindOf(indicator);
  switch (kind) {
    case "phenolphthalein": {
      const t = smoothstep((pH - 8.2) / (10.0 - 8.2));
      return { r: 236, g: 64, b: 160, a: 0.85 * t * doseFactor };
    }
    case "universal": {
      const rgb = universalRgb(pH);
      return { ...rgb, a: 0.6 * doseFactor };
    }
    case "litmus": {
      const rgb = pH < 7 ? { r: 200, g: 40, b: 60 } : { r: 70, g: 80, b: 200 };
      return { ...rgb, a: 0.5 };
    }
    default:
      return assertNever(kind);
  }
}

/** Standard Porter-Duff "over": top painted on top of bottom. */
function compositeOver(top: Rgba, bottom: Rgba): Rgba {
  const outA = top.a + bottom.a * (1 - top.a);
  if (outA <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / outA;
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: outA };
}

/** Full container color: liquid tint with every indicator dose composited over it in dose order. */
export function deriveColor(container: Container): Rgba {
  const pH = derivePh(container) ?? 7.0;
  let color = liquidTint(container);
  for (const dose of container.indicators) {
    const top = indicatorColor(dose.indicator, pH, dose.drops, container.volumeMl);
    color = compositeOver(top, color);
  }
  return color;
}

export function colorDistance(a: Rgba, b: Rgba): number {
  const channelDelta = Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b)) / 255;
  return channelDelta * Math.max(a.a, b.a) + Math.abs(a.a - b.a);
}

interface PaletteEntry {
  readonly name: string;
  readonly rgb: Rgba;
}

const PALETTE: ReadonlyArray<PaletteEntry> = [
  { name: "blue", rgb: { r: 40, g: 120, b: 220, a: 1 } },
  { name: "pink", rgb: { r: 236, g: 64, b: 160, a: 1 } },
  { name: "red", rgb: { r: 220, g: 40, b: 40, a: 1 } },
  { name: "orange", rgb: { r: 240, g: 120, b: 30, a: 1 } },
  { name: "yellow", rgb: { r: 235, g: 210, b: 50, a: 1 } },
  { name: "green", rgb: { r: 60, g: 170, b: 80, a: 1 } },
  { name: "indigo", rgb: { r: 60, g: 50, b: 160, a: 1 } },
  { name: "purple", rgb: { r: 110, g: 30, b: 140, a: 1 } },
];

/** Nearest palette name by channel distance, with a "colorless"/"faint" reading at low alpha. */
export function describeColor(color: Rgba): string {
  // Every liquid carries BASE_TINT.a even with nothing dissolved; exclude it from the colorless
  // test so plain water and untinted species read "colorless" instead of "faint yellow".
  if (color.a - BASE_TINT.a < 0.08) return "colorless";
  let best: PaletteEntry | null = null;
  let bestDist = Infinity;
  for (const entry of PALETTE) {
    const d =
      Math.abs(entry.rgb.r - color.r) + Math.abs(entry.rgb.g - color.g) + Math.abs(entry.rgb.b - color.b);
    if (d < bestDist) {
      bestDist = d;
      best = entry;
    }
  }
  const name = best?.name ?? "colorless";
  return color.a < 0.35 ? `faint ${name}` : name;
}
