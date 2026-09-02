"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { nowMs, type RippleEffect } from "@/scene/effectsStore";

const INNER_RADIUS = 0.045;
const OUTER_RADIUS = 0.06;

export interface RippleProps {
  readonly effect: RippleEffect;
}

/** C3.7 ripple: a ring on the meniscus that grows 0.2 -> 1.0 scale and fades over its duration. */
export function Ripple({ effect }: RippleProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const t = Math.min(1, (nowMs() - effect.startedAt) / effect.durationMs);
    if (meshRef.current) meshRef.current.scale.setScalar(THREE.MathUtils.lerp(0.2, 1, t));
    if (matRef.current) matRef.current.opacity = 0.6 * (1 - t);
  });

  return (
    <mesh
      ref={meshRef}
      position={[effect.at.x, effect.at.y + 0.002, effect.at.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={25}
      raycast={() => null}
    >
      <ringGeometry args={[INNER_RADIUS, OUTER_RADIUS, 32]} />
      <meshBasicMaterial ref={matRef} color={effect.color} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
