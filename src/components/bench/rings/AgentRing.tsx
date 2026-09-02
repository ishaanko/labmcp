"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useLabStore } from "@/store/labStore";
import { visuals } from "@/scene/visualStore";
import { gridToWorld } from "@/components/bench/Bench";
import { resolveCssColor } from "@/scene/textures";

const RING_Y = 0.011;

/** Position for whichever object id `visuals` currently holds, container or instrument. */
function positionOf(id: string): readonly [number, number] | null {
  const obj = useLabStore.getState().lab.objects.find((o) => o.id === id);
  if (!obj) return null;
  return [obj.position.x, obj.position.y];
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

    const grid = positionOf(activeId);
    if (!grid) {
      mesh.visible = false;
      return;
    }
    const [x, , z] = gridToWorld({ x: grid[0], y: grid[1] });
    mesh.position.set(x, RING_Y, z);
    mesh.visible = true;
    mat.opacity = activeValue;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2} raycast={() => null} visible={false}>
      <ringGeometry args={[0.46, 0.52, 64]} />
      <meshBasicMaterial ref={matRef} color={color} transparent opacity={0} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}
