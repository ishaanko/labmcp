export interface BuretteStandProps {
  readonly position: readonly [number, number, number];
}

/** Brushed mid-grey metal for the rod/clamp. */
const ROD_MATERIAL_PROPS = { color: "#75798a", roughness: 0.35, metalness: 0.6 } as const;
/** Dark gunmetal for the base plate, so it reads as a heavier anchor than the rod (scene-composition review). */
const BASE_MATERIAL_PROPS = { color: "#2c2e34", roughness: 0.4, metalness: 0.75 } as const;

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
      <mesh position={[-0.15, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.014, 2.8, 16]} />
        <meshStandardMaterial {...ROD_MATERIAL_PROPS} />
      </mesh>
      <mesh position={[0.03, 2.4, 0]} castShadow>
        <boxGeometry args={[0.1, 0.045, 0.06]} />
        <meshStandardMaterial {...ROD_MATERIAL_PROPS} />
      </mesh>
    </group>
  );
}
