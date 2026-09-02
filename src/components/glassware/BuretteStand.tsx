export interface BuretteStandProps {
  readonly position: readonly [number, number, number];
}

/** Brushed light metal for the rod/clamp: bright enough to read on the #0b0b0c bench. */
const ROD_MATERIAL_PROPS = { color: "#a3a9b8", roughness: 0.3, metalness: 0.7 } as const;
/** Gunmetal for the base plate, a heavier anchor than the rod (scene-composition review). */
const BASE_MATERIAL_PROPS = { color: "#454852", roughness: 0.35, metalness: 0.75 } as const;
/** Thin lit edge along the plate's top, so the plate has an outline against the bench. */
const EDGE_MATERIAL_PROPS = { color: "#7a7f8c", roughness: 0.3, metalness: 0.7 } as const;

/**
 * Static support for the burette (C3.5): a slim plate base, rod, and a clamp roughly where it
 * grips the tube. Slimmer than a lab-supply catalog stand so it frames the burette rather than
 * dominating it. Purely decorative, so it does not register with `visualStore`.
 */
export function BuretteStand({ position }: BuretteStandProps) {
  const [x, y, z] = position;
  return (
    <group position={[x, y, z]}>
      <mesh position={[0.2, 0.015, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.03, 0.28]} />
        <meshStandardMaterial {...BASE_MATERIAL_PROPS} />
      </mesh>
      <mesh position={[0.2, 0.031, 0]}>
        <boxGeometry args={[0.5, 0.004, 0.28]} />
        <meshStandardMaterial {...EDGE_MATERIAL_PROPS} />
      </mesh>
      <mesh position={[-0.15, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 2.8, 16]} />
        <meshStandardMaterial {...ROD_MATERIAL_PROPS} />
      </mesh>
      <mesh position={[0.03, 2.4, 0]} castShadow>
        <boxGeometry args={[0.1, 0.045, 0.06]} />
        <meshStandardMaterial {...ROD_MATERIAL_PROPS} />
      </mesh>
    </group>
  );
}
