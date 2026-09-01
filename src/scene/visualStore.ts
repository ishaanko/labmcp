/**
 * Presentation state for the 3D scene. Lives outside React and outside zustand because it
 * changes every frame. The engine's LabState is the truth; these values chase it.
 *
 * `targets` are written by the animation queue. `visuals` are damped toward `targets` by
 * VisualDriver inside a single useFrame, which then writes uniforms into registered vessel refs.
 */

export interface Rgba01 {
  r: number;
  g: number;
  b: number;
  /** 0..1 */
  a: number;
}

export interface PrecipitateVisual {
  /** Hex color of the solid, e.g. "#f4f2ee". */
  color: string;
  /** 0..1, drives particle count and cloudiness. */
  amount: number;
  /** 0 = suspended, 1 = fully settled. */
  settled: number;
}

export interface VisualState {
  displayedVolumeMl: number;
  displayedColor: Rgba01;
  temperatureC: number;
  precipitate: PrecipitateVisual | null;
  /** 0..1 */
  bubbleIntensity: number;
  /** 0..1 */
  stirring: number;
  /** 0..1, for placement ghosts and disposal fades. */
  opacity: number;
  /** World-space pose override while a pour or drag is in progress; null = rest in its cell. */
  pose: { x: number; y: number; z: number; tiltRad: number } | null;
  /** 0..1 amber bench ring under the vessel (agent presence). */
  agentRing: number;
}

export type VisualTarget = Pick<
  VisualState,
  "displayedVolumeMl" | "displayedColor" | "temperatureC" | "precipitate" | "bubbleIntensity" | "stirring" | "opacity"
>;

export function defaultVisual(): VisualState {
  return {
    displayedVolumeMl: 0,
    displayedColor: { r: 190, g: 214, b: 232, a: 0.35 },
    temperatureC: 22,
    precipitate: null,
    bubbleIntensity: 0,
    stirring: 0,
    opacity: 1,
    pose: null,
    agentRing: 0,
  };
}

export const visuals = new Map<string, VisualState>();
export const targets = new Map<string, VisualTarget>();

export function visualFor(id: string): VisualState {
  let v = visuals.get(id);
  if (!v) {
    v = defaultVisual();
    visuals.set(id, v);
  }
  return v;
}

export function setTarget(id: string, patch: Partial<VisualTarget>): void {
  const current = targets.get(id) ?? visualFor(id);
  targets.set(id, { ...current, ...patch });
}

export function dropVisual(id: string): void {
  visuals.delete(id);
  targets.delete(id);
  vesselRefs.delete(id);
}

/** Refs a vessel component hands to the driver so it can write per-frame values without React. */
export interface VesselRefs {
  /** Called each frame with the current visual state; the vessel writes uniforms and matrices. */
  apply: (v: VisualState, dt: number, elapsed: number) => void;
}

export const vesselRefs = new Map<string, VesselRefs>();

export function registerVessel(id: string, refs: VesselRefs): () => void {
  vesselRefs.set(id, refs);
  return () => {
    if (vesselRefs.get(id) === refs) vesselRefs.delete(id);
  };
}
