"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { assertNever } from "@/engine";
import { useLabStore } from "@/store/labStore";
import type { DragState, XY } from "@/store/types";
import { dampValue } from "@/scene/spring";
import { resolveCssColor } from "@/scene/textures";
import { gridToWorld } from "@/components/bench/Bench";

const RING_Y = 0.013;
/** ~120ms in, a touch slower out (C3.7: "scale 0.9->1.0 120ms"). */
const RING_SMOOTH_TIME = 0.045;

/** Grid cell the current drag (of any kind) is hovering, or null with no live target. */
function hoverCell(drag: DragState | null): XY | null {
  if (!drag) return null;
  switch (drag.kind) {
    case "container":
    case "instrument":
    case "reagent":
    case "indicator": {
      if (!drag.overId) return null;
      const obj = useLabStore.getState().lab.objects.find((o) => o.id === drag.overId);
      return obj ? obj.position : null;
    }
    case "equipment":
      return drag.cell;
    default:
      return assertNever(drag);
  }
}

/**
 * Accent drop-target ring (C3.7, C4.2/C4.3): shared by every drag kind in `DragState`, so a
 * container dragged onto another container, a reagent chip dragged onto one, and equipment
 * snapping to a free cell all render the same ring. Lives here rather than per-drag-kind since
 * it is one small mesh reading one piece of store state.
 */
export function HoverRing() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const scale = useRef({ v: 0.9 });
  const opacity = useRef({ v: 0 });
  const theme = useLabStore((s) => s.ui.theme);
  const color = useMemo(() => resolveCssColor("--accent", theme === "dark" ? "#e0b366" : "#d8a251"), [theme]);

  useFrame((_state, dt) => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    const cell = hoverCell(useLabStore.getState().ui.drag);
    dampValue(scale.current, "v", cell ? 1 : 0.9, RING_SMOOTH_TIME, dt);
    dampValue(opacity.current, "v", cell ? 0.7 : 0, RING_SMOOTH_TIME, dt);

    if (!cell || opacity.current.v <= 0.002) {
      mesh.visible = false;
      return;
    }
    const [x, , z] = gridToWorld(cell);
    mesh.position.set(x, RING_Y, z);
    mesh.scale.setScalar(scale.current.v);
    mesh.visible = true;
    mat.opacity = opacity.current.v;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3} raycast={() => null} visible={false}>
      <ringGeometry args={[0.42, 0.5, 64]} />
      <meshBasicMaterial ref={matRef} color={color} transparent opacity={0} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}
