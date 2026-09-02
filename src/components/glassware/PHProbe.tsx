import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { dampValue, SMOOTH_TIME } from "@/scene/spring";
import { registerVessel } from "@/scene/visualStore";

export interface RimPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly tiltRad: number;
}

export interface PHProbeProps {
  readonly id: string;
  readonly position: readonly [number, number, number];
  /** Rim pose on the attached container, or `null` when resting in its holder. */
  readonly attachedRim: RimPose | null;
}

const METER_OFFSET = new THREE.Vector3(0.35, 0.15, 0);

/**
 * pH probe + meter (C3.5). Drags onto the target rim when attached (C4.6); otherwise it rests
 * in its bench holder. Both poses are damped through the same registered `apply` callback the
 * driver already calls for every vessel, so no extra `useFrame` is needed here.
 */
export function PHProbe({ id, position, attachedRim }: PHProbeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const cableRef = useRef<THREE.Mesh>(null);
  const current = useRef({ x: position[0], y: position[1], z: position[2], tiltRad: 0 });
  const rimRef = useRef(attachedRim);
  const restRef = useRef(position);

  // Kept current for the `apply` callback below, which runs on a later animation frame.
  useEffect(() => {
    rimRef.current = attachedRim;
    restRef.current = position;
  }, [attachedRim, position]);

  const cableGeometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.55, 0),
      new THREE.Vector3(0.1, -0.4, 0.05),
      new THREE.Vector3(0.25, -0.1, 0.05),
      METER_OFFSET.clone().add(new THREE.Vector3(0, 0.15, 0)),
    ]);
    return new THREE.TubeGeometry(curve, 16, 0.006, 6, false);
  }, []);

  useEffect(() => () => cableGeometry.dispose(), [cableGeometry]);

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
        const group = groupRef.current;
        if (group) {
          group.position.set(current.current.x, current.current.y, current.current.z);
          group.rotation.z = current.current.tiltRad;
        }
      },
    });
  }, [id]);

  return (
    <group ref={groupRef} position={position} userData={{ objectId: id }}>
      <mesh position={[0, -0.05, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1.1, 16]} />
        <meshStandardMaterial color="#2c2e33" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.51, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.12, 16]} />
        <meshStandardMaterial color="#1c1e22" roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.58, 0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#e8eef4" roughness={0.2} transparent opacity={0.7} />
      </mesh>
      <mesh ref={cableRef} geometry={cableGeometry}>
        <meshStandardMaterial color="#3a3c42" roughness={0.6} />
      </mesh>
      <mesh position={[METER_OFFSET.x, METER_OFFSET.y, METER_OFFSET.z]}>
        <boxGeometry args={[0.5, 0.3, 0.2]} />
        <meshStandardMaterial color="#f4f2ee" roughness={0.5} />
      </mesh>
    </group>
  );
}
