"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { nowMs, type DropEffect } from "@/scene/effectsStore";

const RADIUS = 0.02;

export interface DropProps {
  readonly effect: DropEffect;
}

/** C3.7 drop: a small sphere falling from the pour point to the meniscus with a t² ease-in, the
 * one ease-in in the app because it is the one thing actually falling. */
export function Drop({ effect }: DropProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = Math.min(1, (nowMs() - effect.startedAt) / effect.durationMs);
    const eased = t * t;
    mesh.position.set(
      THREE.MathUtils.lerp(effect.from.x, effect.to.x, eased),
      THREE.MathUtils.lerp(effect.from.y, effect.to.y, eased),
      THREE.MathUtils.lerp(effect.from.z, effect.to.z, eased),
    );
  });

  return (
    <mesh ref={meshRef} position={[effect.from.x, effect.from.y, effect.from.z]} renderOrder={25} raycast={() => null}>
      <sphereGeometry args={[RADIUS, 10, 10]} />
      <meshBasicMaterial color={effect.color} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
