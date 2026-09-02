"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isSourceActive, nowMs } from "@/scene/effectsStore";
import { BURETTE_PROFILE } from "@/scene/profiles";
import { dampValue, SMOOTH_TIME } from "@/scene/spring";
import { makeGraduationTexture } from "@/scene/textures";
import { Vessel } from "./Vessel";
import { BuretteStand } from "./BuretteStand";

export interface BuretteProps {
  readonly id: string;
  readonly position: readonly [number, number, number];
}

const TIP_LIFT = 0.95;
const LEVER_MAX_RAD = (40 * Math.PI) / 180;

/** World-space tip of the burette at `position` (C3.5: "tip at y 0.95"), where drops and streams
 * originate for `drainJob`. */
export function buretteTipWorld(position: readonly [number, number, number]): Readonly<[number, number, number]> {
  const [x, y, z] = position;
  return [x, y + TIP_LIFT, z];
}

/**
 * 50 mL burette on its stand (C3.5). The tube sits with its tip at y 0.95 so it clears the
 * flask below it; the stand is drawn at ground level under the same cell. The stopcock lever
 * rotates 0 -> 40deg while `effectsStore` has a live stream/drop tagged to this burette, read
 * imperatively each frame rather than through React or `visualStore` state.
 */
export function Burette({ id, position }: BuretteProps) {
  const [x, y, z] = position;
  const lifted: readonly [number, number, number] = [x, y + TIP_LIFT, z];
  const leverRef = useRef<THREE.Group>(null);
  const angle = useRef({ v: 0 });
  // 50 divisions (1 mL major ticks) on a 50 mL burette (C3.5).
  const graduationTexture = useMemo(() => makeGraduationTexture(50), []);
  useEffect(() => () => graduationTexture.dispose(), [graduationTexture]);

  useFrame((_, dt) => {
    const target = isSourceActive(id, nowMs()) ? LEVER_MAX_RAD : 0;
    dampValue(angle.current, "v", target, SMOOTH_TIME.snap, dt);
    if (leverRef.current) leverRef.current.rotation.x = angle.current.v;
  });

  return (
    <group>
      <Vessel id={id} profile={BURETTE_PROFILE} wall={0.01} position={lifted}>
        {/* Graduation marks (C3.4): an alpha-mapped cylinder just outside the glass, past the
            front glass pass's renderOrder 20 so the ticks sit visibly on top. */}
        <mesh position={[0, BURETTE_PROFILE.capacityHeight / 2, 0]} renderOrder={21} raycast={() => null}>
          <cylinderGeometry args={[0.088, 0.088, BURETTE_PROFILE.capacityHeight, 32, 1, true]} />
          <meshBasicMaterial
            color="#2c2e33"
            alphaMap={graduationTexture}
            transparent
            opacity={0.6}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, -0.09, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.005, 0.04, 0.18, 16]} />
          <meshStandardMaterial color="#dfe8f0" roughness={0.2} transparent opacity={0.5} />
        </mesh>
        <mesh position={[0, 0.08, 0.07]} raycast={() => null}>
          <boxGeometry args={[0.12, 0.05, 0.05]} />
          <meshStandardMaterial color="#c7ccd4" roughness={0.5} metalness={0.3} />
        </mesh>
        <group ref={leverRef} position={[0, 0.08, 0.07]}>
          <mesh rotation={[0, 0, Math.PI / 2]} raycast={() => null}>
            <cylinderGeometry args={[0.02, 0.02, 0.14, 12]} />
            <meshStandardMaterial color="#c7ccd4" roughness={0.5} metalness={0.3} />
          </mesh>
        </group>
      </Vessel>
      <BuretteStand position={[x, y, z]} />
    </group>
  );
}
