"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { radiusAt, type LatheProfile } from "@/scene/profiles";
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
  readonly spawnY: number;
  readonly floorJitter: number;
  /** Staggers when each particle reaches the floor, so settling reads as a drift, not a snap. */
  readonly phase: number;
  readonly euler: THREE.Euler;
  /** Per-instance lightness offset for a touch of sparkle against a flat liquid color. */
  readonly tint: number;
}

/** Deterministic PRNG (mulberry32) so a vessel's particles hold their layout across re-renders. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rejection-samples a point inside the vessel's footprint at `y` (C3.7). */
function sampleDisc(profile: LatheProfile, y: number, rng: () => number): readonly [number, number] {
  const r = radiusAt(profile, y) * 0.8;
  for (let attempt = 0; attempt < 6; attempt++) {
    const x = (rng() * 2 - 1) * r;
    const z = (rng() * 2 - 1) * r;
    if (x * x + z * z <= r * r) return [x, z];
  }
  return [0, 0];
}

function seedFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h;
}

function makeSeeds(profile: LatheProfile, containerId: string): ParticleSeed[] {
  const rng = makeRng(seedFor(containerId));
  const seeds: ParticleSeed[] = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const spawnY = profile.capacityHeight * (0.15 + rng() * 0.65);
    const [x, z] = sampleDisc(profile, spawnY, rng);
    seeds.push({
      x,
      z,
      spawnY,
      floorJitter: rng() * 0.01,
      phase: rng(),
      euler: new THREE.Euler(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI),
      tint: (rng() * 2 - 1) * 0.12,
    });
  }
  return seeds;
}

function easeOutCubic(t: number): number {
  const c = 1 - Math.max(0, Math.min(1, t));
  return 1 - c * c * c;
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

  useEffect(() => {
    const mesh = meshRef.current;
    if (mesh) mesh.count = 0;
  }, [containerId]);

  useFrame(() => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material) return;

    const precipitate = visualFor(containerId).precipitate;
    if (!precipitate || precipitate.amount <= 0.002) {
      mesh.count = 0;
      return;
    }

    const active = Math.min(MAX_PARTICLES, Math.round(precipitate.amount * MAX_PARTICLES));
    mesh.count = active;
    if (active === 0) return;

    baseColor.current.set(precipitate.color);
    material.color.copy(baseColor.current);
    const dark = theme === "dark";
    material.emissive.copy(baseColor.current);
    material.emissiveIntensity = dark ? 0.22 : 0;

    for (let i = 0; i < active; i++) {
      const seed = seeds[i];
      if (!seed) continue;
      const t = Math.max(0, Math.min(1, precipitate.settled * 1.15 - seed.phase * 0.15));
      const eased = easeOutCubic(t);
      const floorY = FLOOR_Y + seed.floorJitter;
      const y = seed.spawnY + (floorY - seed.spawnY) * eased;
      DUMMY.position.set(seed.x, y, seed.z);
      DUMMY.rotation.copy(seed.euler);
      DUMMY.scale.setScalar(1);
      DUMMY.updateMatrix();
      mesh.setMatrixAt(i, DUMMY.matrix);
      instanceColor.current.copy(baseColor.current).offsetHSL(0, 0, seed.tint);
      mesh.setColorAt(i, instanceColor.current);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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
