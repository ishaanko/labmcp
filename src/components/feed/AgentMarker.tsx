"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { damp3 } from "maath/easing";
import { Sparkles } from "lucide-react";
import { useLabStore } from "@/store/labStore";
import { selectLastAgentTarget } from "@/store/selectors";
import { gridToWorld } from "@/components/bench/Bench";
import { profileForContainerType } from "@/scene/profiles";
import { clampDt, easeOutCubic } from "@/scene/spring";

const LINGER_MS = 1200;
const ENTER_MS = 120;
const EXIT_MS = 160;

/** World position 8px-equivalent above the rim of `id`, container or instrument, or null if gone. */
function markerAnchor(id: string): readonly [number, number, number] | null {
  const obj = useLabStore.getState().lab.objects.find((o) => o.id === id);
  if (!obj) return null;
  const [x, , z] = gridToWorld(obj.position);
  if (obj.kind === "container") return [x, profileForContainerType(obj.type).capacityHeight + 0.28, z];
  return [x, 1.1, z];
}

/**
 * One HTML marker over the vessel the agent's last tool call acted on (C6 item 2): verb +
 * argument, entering 120ms, lingering 1200ms after the call, then a 160ms exit, moving between
 * vessels with a spring. `target` (from the store) drives whether it renders at all and what it
 * says; position and fade are refs, written straight to the DOM node in `useFrame`, never
 * through `setState`, so a burst of calls never triggers a React render mid-frame.
 */
export function AgentMarker() {
  const target = useLabStore(selectLastAgentTarget);
  const groupRef = useRef<THREE.Group>(null);
  const elRef = useRef<HTMLDivElement>(null);
  const current = useRef<THREE.Vector3 | null>(null);
  const shownAt = useRef(0);
  const hideAt = useRef(0);

  useEffect(() => {
    if (!target) return;
    const now = performance.now();
    // A marker already on screen just extends its linger; only a fresh appearance re-enters.
    if (now > hideAt.current) shownAt.current = now;
    hideAt.current = now + LINGER_MS;
  }, [target]);

  useFrame((_, dt) => {
    const group = groupRef.current;
    const el = elRef.current;
    if (!group || !el || !target) return;

    const anchor = markerAnchor(target.targetId);
    if (!anchor) {
      el.style.opacity = "0";
      return;
    }
    const [ax, ay, az] = anchor;
    if (!current.current) current.current = new THREE.Vector3(ax, ay, az);
    damp3(current.current, [ax, ay, az], 0.14, clampDt(dt));
    group.position.copy(current.current);

    const now = performance.now();
    const age = now - shownAt.current;
    const remaining = hideAt.current - now;
    const opacity =
      age < ENTER_MS ? easeOutCubic(age / ENTER_MS) : remaining < EXIT_MS ? easeOutCubic(Math.max(0, remaining / EXIT_MS)) : 1;
    const scale = 0.96 + 0.04 * easeOutCubic(Math.min(1, age / ENTER_MS));
    el.style.opacity = String(opacity);
    el.style.transform = `scale(${scale})`;
  });

  if (!target) return null;

  return (
    <group ref={groupRef}>
      <Html center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div
          ref={elRef}
          className="material-thin flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-2xs text-accent-ink"
          style={{ opacity: 0 }}
        >
          <Sparkles size={11} />
          {target.label}
        </div>
      </Html>
    </group>
  );
}
