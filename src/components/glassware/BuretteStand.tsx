export interface BuretteStandProps {
  readonly position: readonly [number, number, number];
}

/** Brushed mid-grey metal, shared by every part so the stand reads as one machined object. */
const STAND_MATERIAL_PROPS = { color: "#75798a", roughness: 0.35, metalness: 0.6 } as const;

/**
 * Static support for the burette (C3.5): a slim plate base, rod, and a clamp roughly where it
 * grips the tube. Slimmer than a lab-supply catalog stand so it frames the burette rather than
 * dominating it. Purely decorative, so it does not register with `visualStore`.
 */
export function BuretteStand({ position }: BuretteStandProps) {
  const [x, y, z] = position;
  return (
    <group position={[x, y, z]}>
      <mesh position={[0.25, 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.035, 0.38]} />
        <meshStandardMaterial {...STAND_MATERIAL_PROPS} />
      </mesh>
      <mesh position={[-0.15, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 2.8, 16]} />
        <meshStandardMaterial {...STAND_MATERIAL_PROPS} />
      </mesh>
      <mesh position={[0.05, 2.4, 0]} castShadow>
        <boxGeometry args={[0.16, 0.06, 0.08]} />
        <meshStandardMaterial {...STAND_MATERIAL_PROPS} />
      </mesh>
    </group>
  );
}
