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
  /** Y-rotation so the tilt leans away from the vessel the instrument is attached to. */
  readonly yawRad: number;
}

export interface PHProbeProps {
  readonly id: string;
  readonly position: readonly [number, number, number];
  /** Rim pose on the attached container, or `null` when resting in its holder. */
  readonly attachedRim: RimPose | null;
}

/** Meter box on the bench while attached: beside the probe and toward the camera, clear of a
 * flask's base (0.42) and of the ring under it. */
const ATTACHED_METER_OFFSET = new THREE.Vector3(0.6, 0.15, 0.5);
/** Meter box at rest in the holder (C3.5: "the box sits one cell to the right of the probe holder cell"). */
const REST_METER_OFFSET = new THREE.Vector3(1.0, 0.15, 0);
/** How far below the liquid surface the tip sits (C3.5: "tip 0.15 below the liquid top"). */
const TIP_DEPTH = 0.15;
/** Cable top: the probe cap, local to the tilting probe group. */
const CAP_LOCAL = new THREE.Vector3(0, 0.5, 0);
/** Cable end: the meter box's top, local to the level meter group. */
const BOX_TOP_LOCAL = new THREE.Vector3(0, 0.15, 0);
/** Cable rebuilds only once its ends move by more than this, so a settled pose costs nothing. */
const CABLE_EPS = 0.004;

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

/** A sagging cable from the probe cap to the meter box top, in the meter group's frame. */
function cableGeometry(from: THREE.Vector3, to: THREE.Vector3): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3([
    from,
    new THREE.Vector3(from.x * 0.7 + to.x * 0.3, Math.min(from.y, to.y) * 0.5 + 0.02, from.z * 0.7 + to.z * 0.3 + 0.05),
    new THREE.Vector3(from.x * 0.3 + to.x * 0.7, to.y - 0.05, from.z * 0.3 + to.z * 0.7 + 0.05),
    to,
  ]);
  return new THREE.TubeGeometry(curve, 16, 0.006, 6, false);
}

/**
 * pH probe + meter (C3.5). The probe drags onto the target rim when attached (C4.6); otherwise
 * it rests in its bench holder. The meter box stays level on the bench in both poses (one cell
 * right of the holder at rest, beside the vessel and toward the camera when attached), joined
 * to the probe cap by a cable rebuilt only while either end moves. Both poses are damped through
 * the same registered `apply` callback the driver already calls for every vessel, so no extra
 * `useFrame` is needed here. The tip depth chases the target container's live
 * `displayedVolumeMl` each frame, not just its rim.
 */
export function PHProbe({ id, position, attachedRim }: PHProbeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meterRef = useRef<THREE.Group>(null);
  const cableRef = useRef<THREE.Mesh>(null);
  const current = useRef({ x: position[0], y: position[1], z: position[2], tiltRad: 0, yawRad: 0, mx: position[0] + REST_METER_OFFSET.x, mz: position[2] });
  const cableEnds = useRef({ from: new THREE.Vector3(Infinity, 0, 0), to: new THREE.Vector3() });
  const rimRef = useRef(attachedRim);
  const restRef = useRef(position);
  const { containerId, containerType } = useInstrumentAttachment(id);
  const containerIdRef = useRef(containerId);
  const profile = useMemo<LatheProfile | null>(() => (containerType ? profileForContainerType(containerType) : null), [containerType]);
  const profileRef = useRef(profile);

  // Kept current for the `apply` callback below, which runs on a later animation frame.
  useEffect(() => {
    rimRef.current = attachedRim;
    restRef.current = position;
    containerIdRef.current = containerId;
    profileRef.current = profile;
  }, [attachedRim, position, containerId, profile]);

  useEffect(() => {
    const cable = cableRef.current;
    return () => cable?.geometry.dispose();
  }, []);

  useEffect(() => {
    // Registers this id in `visuals` so `VisualDriver`'s frame loop calls `apply` below; the
    // probe has no volume/color/etc. of its own, only a pose, so a bare presence is enough.
    visualFor(id);
    const cap = new THREE.Vector3();
    const boxTop = new THREE.Vector3();
    return registerVessel(id, {
      apply: (_v, dt) => {
        const target = rimRef.current;
        const [rx, ry, rz] = restRef.current;
        const tx = target ? target.x : rx;
        let ty = target ? target.y : ry;
        const tz = target ? target.z : rz;
        const tTilt = target ? target.tiltRad : 0;
        const tYaw = target ? target.yawRad : 0;
        const meterOffset = target ? ATTACHED_METER_OFFSET : REST_METER_OFFSET;

        const activeProfile = profileRef.current;
        if (target && activeProfile && containerIdRef.current) {
          // `target.y` is the rim at capacity; rebase it onto the live liquid height instead.
          const cy = target.y - activeProfile.capacityHeight + TIP_DEPTH;
          const liquidHeight = heightForVolume(activeProfile, visualFor(containerIdRef.current).displayedVolumeMl);
          ty = cy + liquidHeight - TIP_DEPTH;
        }

        const c = current.current;
        dampValue(c, "x", tx, SMOOTH_TIME.snap, dt);
        dampValue(c, "y", ty, SMOOTH_TIME.snap, dt);
        dampValue(c, "z", tz, SMOOTH_TIME.snap, dt);
        dampValue(c, "tiltRad", tTilt, SMOOTH_TIME.snap, dt);
        dampValue(c, "yawRad", tYaw, SMOOTH_TIME.snap, dt);
        dampValue(c, "mx", tx + meterOffset.x, SMOOTH_TIME.snap, dt);
        dampValue(c, "mz", tz + meterOffset.z, SMOOTH_TIME.snap, dt);
        const group = groupRef.current;
        const meter = meterRef.current;
        const cable = cableRef.current;
        if (!group || !meter || !cable) return;
        group.position.set(c.x, c.y, c.z);
        group.rotation.z = c.tiltRad;
        group.rotation.y = c.yawRad;
        meter.position.set(c.mx, meterOffset.y, c.mz);

        cap.copy(CAP_LOCAL).applyEuler(group.rotation).add(group.position).sub(meter.position);
        boxTop.copy(BOX_TOP_LOCAL);
        const ends = cableEnds.current;
        if (cap.distanceTo(ends.from) < CABLE_EPS && boxTop.distanceTo(ends.to) < CABLE_EPS) return;
        ends.from.copy(cap);
        ends.to.copy(boxTop);
        cable.geometry.dispose();
        cable.geometry = cableGeometry(cap.clone(), boxTop.clone());
      },
    });
  }, [id]);

  return (
    <group userData={{ objectId: id }}>
      <group ref={groupRef} position={position}>
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
        {/* Hit volume for the probe rod (C3.5); the meter box below is the other raycast target. */}
        <mesh visible={false} position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 1.3, 12]} />
          <meshBasicMaterial />
        </mesh>
        {containerId ? <Labels kind="ph" containerId={containerId} anchorRef={groupRef} offset={[0, 0.7, 0]} /> : null}
      </group>
      <group ref={meterRef} position={[position[0] + REST_METER_OFFSET.x, REST_METER_OFFSET.y, position[2]]}>
        <mesh ref={cableRef} raycast={() => null}>
          <meshStandardMaterial color="#3a3c42" roughness={0.6} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.5, 0.3, 0.2]} />
          <meshStandardMaterial color="#f4f2ee" roughness={0.5} />
        </mesh>
        {/* Dark screen inset (C3.5: "small meter box with a dark screen"), on the meter's front face. */}
        <mesh position={[0, 0.02, 0.101]} raycast={() => null}>
          <boxGeometry args={[0.36, 0.16, 0.006]} />
          <meshStandardMaterial color="#14171b" roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}
