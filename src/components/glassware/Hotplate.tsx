import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { dampValue, SMOOTH_TIME } from "@/scene/spring";
import { registerVessel, visualFor } from "@/scene/visualStore";

export interface HotplateProps {
  readonly id: string;
  readonly position: readonly [number, number, number];
  /** Container currently sitting on the plate, if any; drives the glow and the point light. */
  readonly heatedContainerId: string | null;
}

const DIAL_MIN_C = 20;
const DIAL_MAX_C = 110;
const DIAL_MIN_RAD = (-135 * Math.PI) / 180;
const DIAL_MAX_RAD = (135 * Math.PI) / 180;

/** Hotplate (C3.5): emissive plate and a warm point light both track the heated container's temperature. */
export function Hotplate({ id, position, heatedContainerId }: HotplateProps) {
  const plateMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const dialRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const state = useRef({ glow: 0, lightIntensity: 0, dial: DIAL_MIN_RAD });
  const containerIdRef = useRef(heatedContainerId);

  // Kept current for the `apply` callback below, which runs on a later animation frame.
  useEffect(() => {
    containerIdRef.current = heatedContainerId;
  }, [heatedContainerId]);

  useEffect(() => {
    return registerVessel(id, {
      apply: (_v, dt) => {
        const containerId = containerIdRef.current;
        const tempC = containerId ? visualFor(containerId).temperatureC : 22;
        const glowTarget = THREE.MathUtils.smoothstep(tempC, 40, 110) * 1.4;
        const dialTarget = THREE.MathUtils.mapLinear(
          THREE.MathUtils.clamp(tempC, DIAL_MIN_C, DIAL_MAX_C),
          DIAL_MIN_C,
          DIAL_MAX_C,
          DIAL_MIN_RAD,
          DIAL_MAX_RAD,
        );
        dampValue(state.current, "glow", glowTarget, SMOOTH_TIME.temperature, dt);
        dampValue(state.current, "lightIntensity", glowTarget * (3 / 1.4), SMOOTH_TIME.temperature, dt);
        dampValue(state.current, "dial", dialTarget, SMOOTH_TIME.snap, dt);

        if (plateMatRef.current) plateMatRef.current.emissiveIntensity = state.current.glow;
        if (dialRef.current) dialRef.current.rotation.y = state.current.dial;
        if (lightRef.current) lightRef.current.intensity = state.current.lightIntensity;
      },
    });
  }, [id]);

  return (
    <group position={position} userData={{ objectId: id }}>
      <RoundedBox args={[1.0, 0.12, 1.0]} radius={0.03} position={[0, 0.06, 0]} receiveShadow castShadow>
        <meshStandardMaterial color="#d9d6cf" roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.02, 64]} />
        <meshStandardMaterial ref={plateMatRef} color="#2b2b2e" roughness={0.7} emissive="#ff5a1f" emissiveIntensity={0} />
      </mesh>
      <mesh ref={dialRef} position={[0.42, 0.15, 0.42]}>
        <cylinderGeometry args={[0.06, 0.06, 0.04, 16]} />
        <meshStandardMaterial color="#4a4d55" roughness={0.4} metalness={0.4} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 0.4, 0]} color="#ff7a3c" intensity={0} distance={2.5} />
    </group>
  );
}
