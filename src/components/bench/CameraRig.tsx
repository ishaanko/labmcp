import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { damp } from "maath/easing";
import { useLabStore } from "@/store/labStore";

/**
 * Locked perspective camera (C3.1): no orbit, just a fixed position and a subtly parallaxing
 * look target. `BASE_LOOKAT` sits at the titration/unknown_id cluster's center (grid ~0.5, 0.0:
 * burette stand at -1.5 to hotplate at 2.5, centered in the y -0.5..0.5 rows the equipment
 * occupies), a bit above the bench floor. `CAMERA_BASE_POSITION` holds the same downward viewing angle
 * the design doc's (0.8, 6.2, 9.0) sightline used, dollied to a distance that fills roughly
 * two-thirds of the usable vertical band (below the 40px top bar, above the 60px dock) with the
 * cluster, at objects reading about 1.6x their original on-screen size. The x-offset keeps the
 * bench clear of the 300px right panel as the viewport resizes; the pointer parallax is off while
 * dragging, a popover is open, or reduced motion.
 */
const BASE_LOOKAT = new THREE.Vector3(0.5, 1.15, 0.0);
/** Unit direction from `BASE_LOOKAT` back to the camera, along the original design sightline. */
const VIEW_DIR = new THREE.Vector3(0.4, 7.15, 12.0).normalize();
const VIEW_DISTANCE = 10.5;
const cameraPos = BASE_LOOKAT.clone().addScaledVector(VIEW_DIR, VIEW_DISTANCE);
export const CAMERA_BASE_POSITION: readonly [number, number, number] = [cameraPos.x, cameraPos.y, cameraPos.z];
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
    camera.position.set(...CAMERA_BASE_POSITION);
  }, [camera]);

  useFrame((state, dt) => {
    const xOffset = 0.9 * (300 / size.width) * 1.0;
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
