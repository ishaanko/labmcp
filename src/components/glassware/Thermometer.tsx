import { useEffect, useRef } from "react";
import * as THREE from "three";
import { dampValue, SMOOTH_TIME } from "@/scene/spring";
import { registerVessel, visualFor } from "@/scene/visualStore";
import type { RimPose } from "./PHProbe";

export interface ThermometerProps {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly attachedRim: RimPose | null;
  /** Container whose displayed temperature drives the red column, when attached. */
  readonly attachedContainerId: string | null;
}

/** Thermometer (C3.5): a mirrored rim pose from the pH probe, red column scaled by temperature. */
export function Thermometer({ id, position, attachedRim, attachedContainerId }: ThermometerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const columnRef = useRef<THREE.Mesh>(null);
  const current = useRef({ x: position[0], y: position[1], z: position[2], tiltRad: 0, column: 0.2 });
  const rimRef = useRef(attachedRim);
  const restRef = useRef(position);
  const containerIdRef = useRef(attachedContainerId);

  // Kept current for the `apply` callback below, which runs on a later animation frame.
  useEffect(() => {
    rimRef.current = attachedRim;
    restRef.current = position;
    containerIdRef.current = attachedContainerId;
  }, [attachedRim, position, attachedContainerId]);

  useEffect(() => {
    return registerVessel(id, {
      apply: (_v, dt) => {
        const target = rimRef.current;
        const [rx, ry, rz] = restRef.current;
        const tx = target ? target.x : rx;
        const ty = target ? target.y : ry;
        const tz = target ? target.z : rz;
        const tTilt = target ? target.tiltRad : 0;
        dampValue(current.current, "x", tx, SMOOTH_TIME.snap, dt);
        dampValue(current.current, "y", ty, SMOOTH_TIME.snap, dt);
        dampValue(current.current, "z", tz, SMOOTH_TIME.snap, dt);
        dampValue(current.current, "tiltRad", tTilt, SMOOTH_TIME.snap, dt);

        const containerId = containerIdRef.current;
        const readingC = containerId ? visualFor(containerId).temperatureC : 22;
        const columnTarget = Math.min(1, Math.max(0.03, readingC / 110));
        dampValue(current.current, "column", columnTarget, SMOOTH_TIME.temperature, dt);

        const group = groupRef.current;
        if (group) {
          group.position.set(current.current.x, current.current.y, current.current.z);
          group.rotation.z = -current.current.tiltRad;
        }
        const column = columnRef.current;
        if (column) column.scale.y = current.current.column;
      },
    });
  }, [id]);

  return (
    <group ref={groupRef} position={position} userData={{ objectId: id }}>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.9, 16]} />
        <meshStandardMaterial color="#dfe8f0" roughness={0.2} transparent opacity={0.4} />
      </mesh>
      <mesh ref={columnRef} position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 1, 12]} />
        <meshStandardMaterial color="#e0433c" toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.5, 0]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshStandardMaterial color="#e0433c" toneMapped={false} />
      </mesh>
    </group>
  );
}
