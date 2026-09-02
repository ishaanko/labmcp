"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useLabStore } from "@/store/labStore";
import { dampValue } from "@/scene/spring";
import { resolveCssColor } from "@/scene/textures";
import { GRID_SCALE, gridToWorld } from "@/components/bench/Bench";
import { footprintRadius, profileForContainerType } from "@/scene/profiles";

const RING_Y = 0.012;
/** ~120ms settle either direction (C4.1: "selection ring 120ms"). */
const RING_SMOOTH_TIME = 0.045;
/** Gap between the glass and the ring's inner edge, world units. */
const RING_GAP = 0.08;
/** Ring radius under an instrument (probe holder, hotplate). */
const INSTRUMENT_RADIUS = 0.3;
/** A burette's footprint (0.07) sits on its stand plate (0.03 tall), so its ring is drawn on the plate around the tube axis. */
const STAND_RING_RADIUS = 0.22;
const STAND_RING_Y = 0.036;

/**
 * Thin ink-colored ring under whichever container/instrument is selected (C3.7, C4.1). Reads
 * `ui.selectedId` from zustand for the target id (selection changes are rare, so a normal
 * subscription is fine) but looks up its live grid position with `getState()` inside `useFrame`
 * so it never lags a MOVE_OBJECT or drag settle by a render. A unit ring scaled to the object's
 * footprint, same as `AgentRing`, so a burette gets a tight ring on its stand plate rather than
 * a beaker-sized halo one cell behind the flask.
 */
export function SelectionRing() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const scale = useRef({ v: 0.9 });
  const opacity = useRef({ v: 0 });
  const theme = useLabStore((s) => s.ui.theme);
  const color = useMemo(() => resolveCssColor("--ink", theme === "dark" ? "#f2f0ea" : "#383a3f"), [theme]);

  useFrame((_state, dt) => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    const selectedId = useLabStore.getState().ui.selectedId;
    const target = selectedId ? useLabStore.getState().lab.objects.find((o) => o.id === selectedId) : undefined;

    dampValue(scale.current, "v", target ? 1 : 0.9, RING_SMOOTH_TIME, dt);
    dampValue(opacity.current, "v", target ? 0.5 : 0, RING_SMOOTH_TIME, dt);

    if (!target || opacity.current.v <= 0.002) {
      mesh.visible = false;
      return;
    }
    const [x, , z] = gridToWorld(target.position);
    const onStand = target.kind === "container" && target.type === "burette";
    const radius = onStand ? STAND_RING_RADIUS : target.kind === "container" ? footprintRadius(profileForContainerType(target.type)) * GRID_SCALE + RING_GAP : INSTRUMENT_RADIUS;
    mesh.position.set(x, onStand ? STAND_RING_Y : RING_Y, z);
    mesh.scale.setScalar(scale.current.v * radius);
    mesh.visible = true;
    mat.opacity = opacity.current.v;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2} raycast={() => null} visible={false}>
      <ringGeometry args={[1, 1.035, 64]} />
      <meshBasicMaterial ref={matRef} color={color} transparent opacity={0} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}
