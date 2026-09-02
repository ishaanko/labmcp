import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ContainerType } from "@/engine";
import { dampValue, SMOOTH_TIME } from "@/scene/spring";
import { heightForVolume, profileForContainerType, type LatheProfile } from "@/scene/profiles";
import { registerVessel, visualFor } from "@/scene/visualStore";
import { useLabStore } from "@/store/labStore";
import { Labels } from "./Labels";

export interface RimPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly tiltRad: number;
  /** Y-rotation so the instrument body faces away from the vessel it is attached to (its meter
   * box/cable, offset along local +x, swings outward instead of over the vessel). */
  readonly yawRad: number;
}

export interface PHProbeProps {
  readonly id: string;
  readonly position: readonly [number, number, number];
  /** Rim pose on the attached container, or `null` when resting in its holder. */
  readonly attachedRim: RimPose | null;
}

/** Meter box/cable offset while attached: rotated by `RimPose.yawRad` to point away from the
 * vessel, so this can stay short. */
const ATTACHED_METER_OFFSET = new THREE.Vector3(0.35, 0.15, 0);
/** Meter box/cable offset at rest in the holder: no yaw applied, so this alone has to clear the
 * neighboring cell (C3.5: "the box sits one cell to the right of the probe holder cell"). */
const REST_METER_OFFSET = new THREE.Vector3(1.0, 0.15, 0);
/** How far below the liquid surface the tip sits (C3.5: "tip 0.15 below the liquid top"). */
const TIP_DEPTH = 0.15;

function useInstrumentAttachment(id: string): { containerId: string | null; containerType: ContainerType | null } {
  const containerId = useLabStore((s) => {
    const inst = s.lab.objects.find((o) => o.id === id);
    return inst && inst.kind === "instrument" ? inst.attachedTo : null;
  });
  const containerType = useLabStore((s) => {
    if (!containerId) return null;
    const container = s.lab.objects.find((o) => o.id === containerId);
    return container && container.kind === "container" ? container.type : null;
  });
  return { containerId, containerType };
}

/**
 * pH probe + meter (C3.5). Drags onto the target rim when attached (C4.6); otherwise it rests
 * in its bench holder. Both poses are damped through the same registered `apply` callback the
 * driver already calls for every vessel, so no extra `useFrame` is needed here. The tip depth
 * chases the target container's live `displayedVolumeMl` each frame, not just its rim.
 */
export function PHProbe({ id, position, attachedRim }: PHProbeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const current = useRef({ x: position[0], y: position[1], z: position[2], tiltRad: 0, yawRad: 0 });
  const rimRef = useRef(attachedRim);
  const restRef = useRef(position);
  const { containerId, containerType } = useInstrumentAttachment(id);
  const containerIdRef = useRef(containerId);
  const profile = useMemo<LatheProfile | null>(() => (containerType ? profileForContainerType(containerType) : null), [containerType]);
  const profileRef = useRef(profile);
  const meterOffset = attachedRim ? ATTACHED_METER_OFFSET : REST_METER_OFFSET;

  // Kept current for the `apply` callback below, which runs on a later animation frame.
  useEffect(() => {
    rimRef.current = attachedRim;
    restRef.current = position;
    containerIdRef.current = containerId;
    profileRef.current = profile;
  }, [attachedRim, position, containerId, profile]);

  const cableGeometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.55, 0),
      new THREE.Vector3(meterOffset.x * 0.3, -0.4, 0.05),
      new THREE.Vector3(meterOffset.x * 0.7, -0.1, 0.05),
      meterOffset.clone().add(new THREE.Vector3(0, 0.15, 0)),
    ]);
    return new THREE.TubeGeometry(curve, 16, 0.006, 6, false);
  }, [meterOffset]);

  useEffect(() => () => cableGeometry.dispose(), [cableGeometry]);

  useEffect(() => {
    // Registers this id in `visuals` so `VisualDriver`'s frame loop calls `apply` below; the
    // probe has no volume/color/etc. of its own, only a pose, so a bare presence is enough.
    visualFor(id);
    return registerVessel(id, {
      apply: (_v, dt) => {
        const target = rimRef.current;
        const [rx, ry, rz] = restRef.current;
        const tx = target ? target.x : rx;
        let ty = target ? target.y : ry;
        const tz = target ? target.z : rz;
        const tTilt = target ? target.tiltRad : 0;
        const tYaw = target ? target.yawRad : 0;

        const activeProfile = profileRef.current;
        if (target && activeProfile && containerIdRef.current) {
          // `target.y` is the rim at capacity; rebase it onto the live liquid height instead.
          const cy = target.y - activeProfile.capacityHeight + TIP_DEPTH;
          const liquidHeight = heightForVolume(activeProfile, visualFor(containerIdRef.current).displayedVolumeMl);
          ty = cy + liquidHeight - TIP_DEPTH;
        }

        dampValue(current.current, "x", tx, SMOOTH_TIME.snap, dt);
        dampValue(current.current, "y", ty, SMOOTH_TIME.snap, dt);
        dampValue(current.current, "z", tz, SMOOTH_TIME.snap, dt);
        dampValue(current.current, "tiltRad", tTilt, SMOOTH_TIME.snap, dt);
        dampValue(current.current, "yawRad", tYaw, SMOOTH_TIME.snap, dt);
        const group = groupRef.current;
        if (group) {
          group.position.set(current.current.x, current.current.y, current.current.z);
          group.rotation.z = current.current.tiltRad;
          group.rotation.y = current.current.yawRad;
        }
      },
    });
  }, [id]);

  return (
    <group ref={groupRef} position={position} userData={{ objectId: id }}>
      <mesh position={[0, -0.05, 0]} castShadow raycast={() => null}>
        <cylinderGeometry args={[0.05, 0.05, 1.1, 16]} />
        <meshStandardMaterial color="#2c2e33" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.51, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.055, 0.055, 0.12, 16]} />
        <meshStandardMaterial color="#1c1e22" roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.58, 0]} raycast={() => null}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#e8eef4" roughness={0.2} transparent opacity={0.7} />
      </mesh>
      <mesh geometry={cableGeometry} raycast={() => null}>
        <meshStandardMaterial color="#3a3c42" roughness={0.6} />
      </mesh>
      <mesh position={[meterOffset.x, meterOffset.y, meterOffset.z]} raycast={() => null}>
        <boxGeometry args={[0.5, 0.3, 0.2]} />
        <meshStandardMaterial color="#f4f2ee" roughness={0.5} />
      </mesh>
      {/* Dark screen inset (C3.5: "small meter box with a dark screen"), on the meter's front face. */}
      <mesh position={[meterOffset.x, meterOffset.y + 0.02, meterOffset.z + 0.101]} raycast={() => null}>
        <boxGeometry args={[0.36, 0.16, 0.006]} />
        <meshStandardMaterial color="#14171b" roughness={0.3} />
      </mesh>
      {/* Single hit volume for the whole assembly (C3.5): the only raycast target for drag/select. */}
      <mesh visible={false} userData={{ objectId: id }} position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 1.3, 12]} />
        <meshBasicMaterial />
      </mesh>
      {containerId ? <Labels kind="ph" containerId={containerId} anchorRef={groupRef} offset={[0, 0.7, 0]} /> : null}
    </group>
  );
}
