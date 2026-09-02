import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { clear, tick } from "@/scene/animationQueue";
import { dampValue, SMOOTH_TIME } from "@/scene/spring";
import { targets, vesselRefs, visuals, type VisualState } from "@/scene/visualStore";
import { useLabStore } from "@/store/labStore";

/**
 * The one per-frame driver (C3.8): ticks the animation queue, damps every registered visual
 * toward its target, then hands the result to that vessel's own `apply` so it can write
 * uniforms and matrices. No React state changes here; only refs and the module-level maps.
 */
export function VisualDriver() {
  useEffect(() => {
    // Seed from whatever the canonical state already is, independent of when the animation
    // sink happened to register (the store may dispatch before this canvas ever mounts).
    clear(useLabStore.getState().lab);
  }, []);

  useFrame((state, rawDt) => {
    const reducedMotion = useLabStore.getState().ui.reducedMotion;
    const st = (normal: number): number => (reducedMotion ? SMOOTH_TIME.reduced : normal);
    const dt = rawDt;
    const elapsed = state.clock.elapsedTime;

    tick(dt);

    for (const [id, visual] of visuals) {
      const target = targets.get(id);
      if (target) {
        dampValue(visual, "displayedVolumeMl", target.displayedVolumeMl, st(SMOOTH_TIME.snap), dt);
        dampValue(visual.displayedColor, "r", target.displayedColor.r, st(SMOOTH_TIME.color), dt);
        dampValue(visual.displayedColor, "g", target.displayedColor.g, st(SMOOTH_TIME.color), dt);
        dampValue(visual.displayedColor, "b", target.displayedColor.b, st(SMOOTH_TIME.color), dt);
        dampValue(visual.displayedColor, "a", target.displayedColor.a, st(SMOOTH_TIME.color), dt);
        dampValue(visual, "temperatureC", target.temperatureC, st(SMOOTH_TIME.temperature), dt);
        dampValue(visual, "bubbleIntensity", target.bubbleIntensity, st(SMOOTH_TIME.bubble), dt);
        dampValue(visual, "stirring", target.stirring, st(SMOOTH_TIME.stir), dt);
        dampValue(visual, "opacity", target.opacity, st(SMOOTH_TIME.opacity), dt);
        stepPrecipitate(visual, target.precipitate, dt, st);
        stepPose(visual, target.pose, dt, st);
        dampValue(visual, "agentRing", target.agentRing, st(visual.agentRing < target.agentRing ? SMOOTH_TIME.ringIn : SMOOTH_TIME.ringOut), dt);
      }
      vesselRefs.get(id)?.apply(visual, dt, elapsed);
    }
  });

  return null;
}

function stepPrecipitate(visual: VisualState, target: VisualState["precipitate"], dt: number, st: (n: number) => number): void {
  if (!target) {
    visual.precipitate = null;
    return;
  }
  const current = visual.precipitate ?? { color: target.color, amount: 0, settled: 0 };
  const amount = { v: current.amount };
  const settled = { v: current.settled };
  dampValue(amount, "v", target.amount, st(SMOOTH_TIME.precipitateAmount), dt);
  dampValue(settled, "v", target.settled, st(SMOOTH_TIME.precipitateSettle), dt);
  visual.precipitate = { color: target.color, amount: amount.v, settled: settled.v };
}

function stepPose(visual: VisualState, target: VisualState["pose"], dt: number, st: (n: number) => number): void {
  if (!target) {
    visual.pose = null;
    return;
  }
  if (!visual.pose) {
    visual.pose = { ...target };
    return;
  }
  const pose = visual.pose;
  dampValue(pose, "x", target.x, st(SMOOTH_TIME.snap), dt);
  dampValue(pose, "y", target.y, st(SMOOTH_TIME.snap), dt);
  dampValue(pose, "z", target.z, st(SMOOTH_TIME.snap), dt);
  dampValue(pose, "tiltRad", target.tiltRad, st(SMOOTH_TIME.snap), dt);
}
