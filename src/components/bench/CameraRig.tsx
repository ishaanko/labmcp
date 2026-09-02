import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { damp } from "maath/easing";
import { useLabStore } from "@/store/labStore";

/**
 * Locked perspective camera (C3.1): no orbit, just a fixed position and a subtly parallaxing
 * look target. Dollied back from the design doc's literal (0.8, 6.2, 9.0) along the same
 * sightline, at `Bench.GRID_SCALE`, so the full usable grid (x -4.5..3.5, z -1.5..1.5) clears
 * both the top bar and the right panel, including the burette's ~2.9-unit stand. The x-offset
 * keeps the bench clear of the 300px right panel as the viewport resizes; the pointer parallax
 * is off while dragging, a popover is open, or reduced motion.
 */
const BASE_POSITION = new THREE.Vector3(0.8, 7.9, 11.8);
const BASE_LOOKAT = new THREE.Vector3(0.8, 0.45, -0.3);
const PARALLAX_SMOOTH_TIME = 0.6;
const MAX_YAW_RAD = (1.2 * Math.PI) / 180;
const MAX_PITCH_RAD = (0.6 * Math.PI) / 180;

export function CameraRig() {
  const { camera, size } = useThree();
  const dragging = useLabStore((s) => s.ui.drag !== null);
  const dialogOpen = useLabStore((s) => s.ui.dialog !== null);
  const reducedMotion = useLabStore((s) => s.ui.reducedMotion);
  const yaw = useRef({ v: 0 });
  const pitch = useRef({ v: 0 });
  const target = useRef(new THREE.Vector3());

  // fov 30 is already set via <Canvas camera={{ fov: 30, ... }}>; this only pins the position.
  useEffect(() => {
    camera.position.copy(BASE_POSITION);
  }, [camera]);

  useFrame((state, dt) => {
    const xOffset = 0.8 * (300 / size.width) * 1.0;
    const parallaxAllowed = !dragging && !dialogOpen && !reducedMotion;
    const targetYaw = parallaxAllowed ? state.pointer.x * MAX_YAW_RAD : 0;
    const targetPitch = parallaxAllowed ? state.pointer.y * MAX_PITCH_RAD : 0;
    damp(yaw.current, "v", targetYaw, PARALLAX_SMOOTH_TIME, dt);
    damp(pitch.current, "v", targetPitch, PARALLAX_SMOOTH_TIME, dt);

    target.current.set(BASE_LOOKAT.x + xOffset, BASE_LOOKAT.y, BASE_LOOKAT.z);
    const distance = camera.position.distanceTo(target.current);
    target.current.x += Math.tan(yaw.current.v) * distance;
    target.current.y += Math.tan(pitch.current.v) * distance;
    camera.lookAt(target.current);
  });

  return null;
}
