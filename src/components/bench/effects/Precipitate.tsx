"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { heightForVolume, radiusAt, type LatheProfile } from "@/scene/profiles";
import { hashId, makeRng } from "@/scene/rng";
import { easeOutCubic } from "@/scene/spring";
import { visualFor } from "@/scene/visualStore";
import { useLabStore } from "@/store/labStore";

export interface PrecipitateProps {
  readonly containerId: string;
  readonly profile: LatheProfile;
  readonly origin: readonly [number, number, number];
}

const MAX_PARTICLES = 320;
const PARTICLE_SIZE = 0.014;
const FLOOR_Y = 0.011;
const DUMMY = new THREE.Object3D();

interface ParticleSeed {
  readonly x: number;
  readonly z: number;
  /** Spawn height as a fraction of the live liquid height, so the cloud scales with volume. */
  readonly spawnT: number;
  readonly floorJitter: number;
  /** Staggers when each particle reaches the floor, so settling reads as a drift, not a snap. */
  readonly phase: number;
  readonly euler: THREE.Euler;
  /** Per-instance lightness offset for a touch of sparkle against a flat liquid color. */
  readonly tint: number;
}

/** Rejection-samples a point inside the vessel's footprint at height `y` (C3.7). */
function sampleDisc(profile: LatheProfile, y: number, rng: () => number): readonly [number, number] {
  const r = radiusAt(profile, y) * 0.8;
  for (let attempt = 0; attempt < 6; attempt++) {
    const x = (rng() * 2 - 1) * r;
    const z = (rng() * 2 - 1) * r;
    if (x * x + z * z <= r * r) return [x, z];
  }
  return [0, 0];
}

function makeSeeds(profile: LatheProfile, containerId: string): ParticleSeed[] {
  const rng = makeRng(hashId(containerId));
  const seeds: ParticleSeed[] = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const [x, z] = sampleDisc(profile, profile.capacityHeight * 0.3, rng);
    seeds.push({
      x,
      z,
      spawnT: 0.15 + rng() * 0.8,
      floorJitter: rng() * 0.01,
      phase: rng(),
      euler: new THREE.Euler(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI),
      tint: (rng() * 2 - 1) * 0.12,
    });
  }
  return seeds;
}

/**
 * A vessel's precipitate as instanced particles (C3.7): each spawns inside the liquid and
 * settles toward the floor on its own staggered `phase`, so `settled` (driven by
 * `visualStore`/`stirJob`) reads as a drift down or a stirred-up cloud rather than a toggle.
 * `amount` only ever controls how many of the precomputed instances are visible; positions never
 * reshuffle, so revealing more particles as a reaction proceeds never looks like a pop.
 */
export function Precipitate({ containerId, profile, origin }: PrecipitateProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const theme = useLabStore((s) => s.ui.theme);
  const seeds = useMemo(() => makeSeeds(profile, containerId), [profile, containerId]);
  const baseColor = useRef(new THREE.Color());
  const instanceColor = useRef(new THREE.Color());
  // Tracks what the instance color buffer was last painted for, so a steady-state settle (every
  // frame, `amount`/`settled` still moving) only ever touches the matrices, not the colors.
  const paintedFor = useRef({ color: "", theme, active: 0 });

  useFrame(() => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material) return;

    const precipitate = visualFor(containerId).precipitate;
    if (!precipitate || precipitate.amount <= 0.002) {
      mesh.count = 0;
      paintedFor.current.active = 0;
      return;
    }

    const liquidY = heightForVolume(profile, visualFor(containerId).displayedVolumeMl);
    const active = Math.min(MAX_PARTICLES, Math.round(precipitate.amount * MAX_PARTICLES));
    mesh.count = active;
    if (active === 0) {
      paintedFor.current.active = 0;
      return;
    }

    const painted = paintedFor.current;
    const colorChanged = painted.color !== precipitate.color || painted.theme !== theme;
    // Instances beyond the last paint's `active` were never assigned a color at all, so they
    // need one regardless of whether the color itself changed.
    const growFrom = colorChanged ? 0 : painted.active;
    if (colorChanged) {
      baseColor.current.set(precipitate.color);
      material.color.copy(baseColor.current);
      const dark = theme === "dark";
      material.emissive.copy(baseColor.current);
      material.emissiveIntensity = dark ? 0.22 : 0;
    }

    let colorTouched = false;
    for (let i = 0; i < active; i++) {
      const seed = seeds[i];
      if (!seed) continue;
      const t = Math.max(0, Math.min(1, precipitate.settled * 1.15 - seed.phase * 0.15));
      const eased = easeOutCubic(t);
      const floorY = FLOOR_Y + seed.floorJitter;
      const spawnY = liquidY * seed.spawnT;
      const y = spawnY + (floorY - spawnY) * eased;
      DUMMY.position.set(seed.x, y, seed.z);
      DUMMY.rotation.copy(seed.euler);
      DUMMY.scale.setScalar(1);
      DUMMY.updateMatrix();
      mesh.setMatrixAt(i, DUMMY.matrix);
      if (i >= growFrom) {
        instanceColor.current.copy(baseColor.current).offsetHSL(0, 0, seed.tint);
        mesh.setColorAt(i, instanceColor.current);
        colorTouched = true;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (colorTouched && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    painted.color = precipitate.color;
    painted.theme = theme;
    painted.active = active;
  });

  return (
    <group position={origin}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]} renderOrder={15} raycast={() => null} frustumCulled={false}>
        <icosahedronGeometry args={[PARTICLE_SIZE, 0]} />
        <meshStandardMaterial ref={materialRef} roughness={0.9} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
