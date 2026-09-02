export interface BuretteStandProps {
  readonly position: readonly [number, number, number];
}

/**
 * Static support for the burette (C3.5): base, rod, and a clamp roughly where it grips the
 * tube. Purely decorative, so it does not register with `visualStore`.
 */
export function BuretteStand({ position }: BuretteStandProps) {
  const [x, y, z] = position;
  return (
    <group position={[x, y, z]}>
      <mesh position={[0.25, 0.03, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.06, 0.5]} />
        <meshStandardMaterial color="#4a4d55" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[-0.15, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 2.8, 16]} />
        <meshStandardMaterial color="#4a4d55" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh position={[0.05, 2.4, 0]} castShadow>
        <boxGeometry args={[0.2, 0.08, 0.1]} />
        <meshStandardMaterial color="#4a4d55" roughness={0.4} metalness={0.4} />
      </mesh>
    </group>
  );
}
