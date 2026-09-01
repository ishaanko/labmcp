"use client";

import { Canvas } from "@react-three/fiber";

/** Placeholder scene. The scene-foundation work replaces this with the bench, lighting, and glassware. */
export function LabCanvas() {
  return (
    <Canvas className="absolute inset-0" camera={{ fov: 30, position: [0.8, 6.2, 9.0] }} dpr={[1, 1.5]}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 8, 4]} intensity={2} />
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 8]} />
        <meshStandardMaterial color="#eceae4" />
      </mesh>
    </Canvas>
  );
}
