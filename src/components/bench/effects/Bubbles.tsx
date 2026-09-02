"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { heightForVolume, radiusAt, type LatheProfile } from "@/scene/profiles";
import { hashId, makeRng } from "@/scene/rng";
import { visualFor } from "@/scene/visualStore";
import { useLabStore } from "@/store/labStore";

export interface BubblesProps {
  readonly containerId: string;
  readonly profile: LatheProfile;
  readonly origin: readonly [number, number, number];
}

const MAX_BUBBLES = 64;
const DUMMY = new THREE.Object3D();
const REDUCED_OPACITY = 0.55 * 0.4;

interface BubbleSeed {
  /** Unit disc position, scaled by `radiusAt(fill) * 0.8` each frame as the vessel narrows. */
  readonly dirX: number;
  readonly dirZ: number;
  readonly discFrac: number;
  readonly radius: number;
  readonly speed: number;
  readonly phase: number;
}

function makeSeeds(containerId: string): BubbleSeed[] {
  const rng = makeRng(hashId(containerId) ^ 0x9e3779b9);
  const seeds: BubbleSeed[] = [];
  for (let i = 0; i < MAX_BUBBLES; i++) {
    const angle = rng() * Math.PI * 2;
    seeds.push({
      dirX: Math.cos(angle),
      dirZ: Math.sin(angle),
      discFrac: Math.sqrt(rng()),
      radius: 0.008 + rng() * 0.014,
      speed: 0.35 + rng() * 0.25,
      phase: rng(),
    });
  }
  return seeds;
}

/**
 * Rising gas bubbles (C3.7): instance count tracks `bubbleIntensity`, each wraps back to the
 * floor once it clears the current fill height. Frozen under reduced motion, at 40% opacity.
 */
export function Bubbles({ containerId, profile, origin }: BubblesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const reducedMotion = useLabStore((s) => s.ui.reducedMotion);
  const seeds = useMemo(() => makeSeeds(containerId), [containerId]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material) return;

    const visual = visualFor(containerId);
    const active = Math.min(MAX_BUBBLES, Math.round(visual.bubbleIntensity * MAX_BUBBLES));
    mesh.count = active;
    if (active === 0) return;

    material.opacity = reducedMotion ? REDUCED_OPACITY : 0.55;
    const fillHeight = heightForVolume(profile, visual.displayedVolumeMl);
    if (fillHeight <= 0.001) {
      mesh.count = 0;
      return;
    }

    for (let i = 0; i < active; i++) {
      const seed = seeds[i];
      if (!seed) continue;
      const rise = reducedMotion ? seed.phase : (clock.elapsedTime * seed.speed + seed.phase) % 1;
      const y = rise * fillHeight;
      const r = radiusAt(profile, y) * 0.8 * seed.discFrac;
      DUMMY.position.set(seed.dirX * r, y, seed.dirZ * r);
      DUMMY.scale.setScalar(seed.radius * (1 + 0.2 * rise));
      DUMMY.updateMatrix();
      mesh.setMatrixAt(i, DUMMY.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={origin}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_BUBBLES]} renderOrder={15} raycast={() => null} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial ref={materialRef} color="#ffffff" transparent opacity={0.55} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
