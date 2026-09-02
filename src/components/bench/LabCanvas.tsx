"use client";

import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { CameraRig } from "./CameraRig";
import { Lighting } from "./Lighting";
import { Bench } from "./Bench";
import { Objects } from "./Objects";
import { VisualDriver } from "./VisualDriver";

/**
 * The R3F canvas (C3.1): a locked camera, the Lightformer rig, the bench, every placed object,
 * and the single `VisualDriver` frame loop that animates them all.
 */
export function LabCanvas() {
  return (
    <Canvas
      className="absolute inset-0"
      shadows
      dpr={[1, 1.5]}
      frameloop="always"
      camera={{ fov: 30, position: [0.8, 6.2, 9.0], near: 0.1, far: 40 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
    >
      <CameraRig />
      <Lighting />
      <Bench />
      <Objects />
      <VisualDriver />
    </Canvas>
  );
}
