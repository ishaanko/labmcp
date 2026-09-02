"use client";

import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboard } from "@/hooks/useKeyboard";
import { setSceneRefs } from "@/scene/sceneRefs";
import { CameraRig } from "./CameraRig";
import { Lighting } from "./Lighting";
import { Bench } from "./Bench";
import { Objects } from "./Objects";
import { DragController } from "./DragController";
import { VisualDriver } from "./VisualDriver";
import { AgentRing } from "./rings/AgentRing";
import { AgentMarker } from "@/components/feed/AgentMarker";
import { HoverRing } from "./rings/HoverRing";
import { SelectionRing } from "./rings/SelectionRing";

/** Keeps `sceneRefs` (camera/scene/canvas element/size) current for helpers used outside the Canvas. */
function SceneRefsBridge() {
  const { camera, scene, gl, size } = useThree();
  useEffect(() => {
    setSceneRefs({ camera, scene, domElement: gl.domElement, size });
    return () => setSceneRefs(null);
  }, [camera, scene, gl, size]);
  return null;
}

/**
 * The R3F canvas (C3.1): a locked camera, the Lightformer rig, the bench, every placed object,
 * pointer-driven dragging, and the single `VisualDriver` frame loop that animates them all.
 * `DragController` is mounted before `VisualDriver` so a drag's direct `visualStore` writes land
 * before the driver's damp reads them in the same frame. `useKeyboard` runs in this component's
 * plain React body (outside the Canvas's own reconciler) since it only needs a window listener.
 */
export function LabCanvas() {
  useKeyboard();

  return (
    <Canvas
      className="absolute inset-0"
      shadows
      dpr={[1, 1.5]}
      frameloop="always"
      tabIndex={0}
      camera={{ fov: 30, position: [0.8, 7.9, 11.8], near: 0.1, far: 40 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
    >
      <SceneRefsBridge />
      <CameraRig />
      <Lighting />
      <Bench />
      <Objects />
      <SelectionRing />
      <HoverRing />
      <AgentRing />
      <AgentMarker />
      <DragController />
      <VisualDriver />
    </Canvas>
  );
}
