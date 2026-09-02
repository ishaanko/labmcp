"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useLabStore } from "@/store/labStore";
import { visuals } from "@/scene/visualStore";
import { GRID_SCALE, gridToWorld } from "@/components/bench/Bench";
import { footprintRadius, profileForContainerType } from "@/scene/profiles";
import { resolveCssColor } from "@/scene/textures";

const RING_Y = 0.012;
/** Gap between the glass and the ring's inner edge, world units. */
const RING_GAP = 0.05;
/** Band width as a fraction of the inner radius (about 0.07 world units on a beaker). */
const RING_BAND = 0.16;

interface RingTarget {
  x: number;
  y: number;
  /** Base radius of the vessel (or a fixed size for instruments) the ring hugs. */
  readonly radius: number;
}

/**
 * Amber additive bench ring under whichever vessel the agent last acted on (C6 item 1). Driven
 * entirely by `visualStore.visuals[id].agentRing`, which `animationQueue.ts` pulses to 0.9 and
 * decays back to 0 on every agent-attributed event; this component only ever reads it and never
 * writes React state, so it costs nothing beyond one small mesh.
 */
export function AgentRing() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const theme = useLabStore((s) => s.ui.theme);
  const color = useMemo(() => resolveCssColor("--accent", theme === "dark" ? "#e0b366" : "#d8a251"), [theme]);
  // Radius is fixed per id (it only depends on the object's type, not its live position), so it
  // is computed once and reused; only x/y are refreshed in place each frame this id is active.
  const targetCache = useRef(new Map<string, RingTarget>());

  useFrame(() => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    let activeId: string | null = null;
    let activeValue = 0;
    for (const [id, v] of visuals) {
      if (v.agentRing > activeValue) {
        activeValue = v.agentRing;
        activeId = id;
      }
    }

    if (!activeId || activeValue <= 0.001) {
      mesh.visible = false;
      return;
    }

    const obj = useLabStore.getState().lab.objects.find((o) => o.id === activeId);
    if (!obj) {
      mesh.visible = false;
      return;
    }
    let target = targetCache.current.get(activeId);
    if (!target) {
      const radius = obj.kind === "container" ? footprintRadius(profileForContainerType(obj.type)) * GRID_SCALE : 0.3;
      target = { x: obj.position.x, y: obj.position.y, radius };
      targetCache.current.set(activeId, target);
    } else {
      target.x = obj.position.x;
      target.y = obj.position.y;
    }
    const [x, , z] = gridToWorld({ x: target.x, y: target.y });
    mesh.position.set(x, RING_Y, z);
    // Unit ring geometry scaled to the vessel's footprint, so a burette gets a tight ring and a
    // beaker a wide one without rebuilding geometry.
    mesh.scale.setScalar(target.radius + RING_GAP);
    mesh.visible = true;
    mat.opacity = activeValue;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3} raycast={() => null} visible={false}>
      <ringGeometry args={[1, 1 + RING_BAND, 64]} />
      <meshBasicMaterial ref={matRef} color={color} transparent opacity={0} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}
