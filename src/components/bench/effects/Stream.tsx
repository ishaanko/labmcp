"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { nowMs, type StreamEffect } from "@/scene/effectsStore";

const FADE_IN_MS = 60;
const RADIUS = 0.012;
const UP = new THREE.Vector3(0, 1, 0);

export interface StreamProps {
  readonly effect: StreamEffect;
}

/** C3.7 stream: a thin cylinder from the pour point to the meniscus, fading in over 60ms. */
export function Stream({ effect }: StreamProps) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  const { mid, length, quaternion } = useMemo(() => {
    const start = new THREE.Vector3(effect.from.x, effect.from.y, effect.from.z);
    const end = new THREE.Vector3(effect.to.x, effect.to.y, effect.to.z);
    const delta = end.clone().sub(start);
    const len = Math.max(0.001, delta.length());
    return {
      mid: start.add(end).multiplyScalar(0.5),
      length: len,
      quaternion: new THREE.Quaternion().setFromUnitVectors(UP, delta.normalize()),
    };
  }, [effect.from, effect.to]);

  useFrame(() => {
    const mat = matRef.current;
    if (!mat) return;
    const elapsed = nowMs() - effect.startedAt;
    mat.opacity = 0.7 * Math.min(1, elapsed / FADE_IN_MS);
  });

  return (
    <mesh position={mid} quaternion={quaternion} renderOrder={25} raycast={() => null}>
      <cylinderGeometry args={[RADIUS, RADIUS, length, 8]} />
      <meshBasicMaterial ref={matRef} color={effect.color} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
