import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { dampValue, SMOOTH_TIME } from "@/scene/spring";
import { heightForVolume, innerProfile, radiusAt, type LatheProfile } from "@/scene/profiles";
import { registerVessel, type VisualState } from "@/scene/visualStore";
import "@/scene/materials/GlassRimMaterial";
import "@/scene/materials/LiquidMaterial";
import type { GlassRimMaterial } from "@/scene/materials/GlassRimMaterial";
import type { LiquidMaterial } from "@/scene/materials/LiquidMaterial";

/**
 * The shared glassware assembly (C3.4-C3.6): glass shell, liquid body, meniscus, sediment, and
 * an invisible hit volume, in the render order the design calls for. Every container type
 * (Beaker, Erlenmeyer, Burette, TestTube, GradCylinder) builds one of these with its own
 * profile and hangs type-specific extras (handles, spouts, a hex base, graduations) off
 * `children`. It registers with `visualStore` on mount and never reads volume/color itself:
 * `VisualDriver` drives every visible number through the `apply` callback each frame.
 */
export interface VesselProps {
  readonly id: string;
  readonly profile: LatheProfile;
  /** Glass wall thickness the liquid body sits inside of. */
  readonly wall?: number;
  readonly position: readonly [number, number, number];
  readonly rotationY?: number;
  readonly children?: ReactNode;
}

const SEGMENTS = 48;

function toLatheVectors(profile: LatheProfile): THREE.Vector2[] {
  return profile.points.map((p) => new THREE.Vector2(p.r, p.y));
}

export function Vessel({ id, profile, wall = 0.02, position, rotationY = 0, children }: VesselProps) {
  const groupRef = useRef<THREE.Group>(null);
  const liquidMatRef = useRef<LiquidMaterial>(null);
  const meniscusMatRef = useRef<LiquidMaterial>(null);
  const meniscusMeshRef = useRef<THREE.Mesh>(null);
  const sedimentMeshRef = useRef<THREE.Mesh>(null);
  const sedimentMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const glassBackMatRef = useRef<GlassRimMaterial>(null);
  const glassFrontMatRef = useRef<GlassRimMaterial>(null);
  const restPose = useRef<readonly [number, number, number]>(position);
  const fill = useRef({ v: 0 });

  // Kept current for the `apply` callback below, which runs on a later animation frame, never
  // during this render.
  useEffect(() => {
    restPose.current = position;
  }, [position]);

  const inner = useMemo(() => innerProfile(profile, wall), [profile, wall]);
  const glassGeometry = useMemo(() => new THREE.LatheGeometry(toLatheVectors(profile), SEGMENTS), [profile]);
  const liquidGeometry = useMemo(() => new THREE.LatheGeometry(toLatheVectors(inner), SEGMENTS), [inner]);
  const meniscusGeometry = useMemo(() => new THREE.CircleGeometry(1, SEGMENTS), []);
  const sedimentGeometry = useMemo(() => new THREE.CircleGeometry(1, 32), []);
  const hitHeight = profile.capacityHeight + 0.1;
  const hitRadius = radiusAt(profile, profile.capacityHeight) + 0.12;

  useEffect(() => {
    return () => {
      glassGeometry.dispose();
      liquidGeometry.dispose();
      meniscusGeometry.dispose();
      sedimentGeometry.dispose();
    };
  }, [glassGeometry, liquidGeometry, meniscusGeometry, sedimentGeometry]);

  useEffect(() => {
    return registerVessel(id, {
      apply: (v: VisualState, dt: number, elapsed: number) => {
        const group = groupRef.current;
        if (group) {
          const pose = v.pose;
          if (pose) {
            group.position.set(pose.x, pose.y, pose.z);
            group.rotation.z = pose.tiltRad;
          } else {
            const [rx, ry, rz] = restPose.current;
            group.position.set(rx, ry, rz);
            group.rotation.z = 0;
          }
          const scale = 0.96 + 0.04 * v.opacity;
          group.scale.setScalar(scale);
        }

        dampValue(fill.current, "v", heightForVolume(profile, v.displayedVolumeMl), SMOOTH_TIME.fillLocal, dt);
        const fillY = fill.current.v;
        const color01 = v.displayedColor;
        const color = new THREE.Color(color01.r / 255, color01.g / 255, color01.b / 255);

        const liquidMat = liquidMatRef.current;
        if (liquidMat) {
          liquidMat.uniforms.uFill.value = fillY;
          liquidMat.uniforms.uColor.value.copy(color);
          liquidMat.uniforms.uAlpha.value = color01.a;
          liquidMat.uniforms.uCloud.value = v.precipitate ? Math.min(1, v.precipitate.amount * (1 - 0.75 * v.precipitate.settled)) : 0;
          liquidMat.uniforms.uTime.value = elapsed;
          liquidMat.uniforms.uStir.value = v.stirring;
          liquidMat.opacity = v.opacity;
        }

        const meniscusMat = meniscusMatRef.current;
        if (meniscusMat) {
          meniscusMat.uniforms.uFill.value = fillY;
          meniscusMat.uniforms.uColor.value.copy(color);
          meniscusMat.uniforms.uAlpha.value = color01.a;
          meniscusMat.uniforms.uTime.value = elapsed;
          meniscusMat.uniforms.uStir.value = v.stirring;
          meniscusMat.opacity = v.opacity;
        }
        const meniscusMesh = meniscusMeshRef.current;
        if (meniscusMesh) {
          const r = Math.max(0.001, radiusAt(inner, fillY) - 0.005);
          meniscusMesh.position.y = fillY;
          meniscusMesh.scale.set(r, r, r);
          meniscusMesh.visible = v.displayedVolumeMl > 0.01;
        }

        const sedimentMesh = sedimentMeshRef.current;
        const sedimentMat = sedimentMatRef.current;
        if (sedimentMesh && sedimentMat && v.precipitate) {
          const amount = v.precipitate.amount;
          const settled = v.precipitate.settled;
          const r = Math.max(0.001, radiusAt(inner, 0)) * (0.5 + 0.5 * amount);
          sedimentMesh.scale.set(r, r, r);
          sedimentMesh.visible = amount > 0.001;
          sedimentMat.color.set(v.precipitate.color);
          sedimentMat.opacity = amount * settled * 0.9;
        } else if (sedimentMesh) {
          sedimentMesh.visible = false;
        }

        if (glassBackMatRef.current) glassBackMatRef.current.uniforms.uOpacity.value = v.opacity;
        if (glassFrontMatRef.current) glassFrontMatRef.current.uniforms.uOpacity.value = v.opacity;
      },
    });
  }, [id, profile, inner]);

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={glassGeometry} renderOrder={5} raycast={() => null}>
        <glassRimMaterial ref={glassBackMatRef} args={[0.03, 0.3]} side={THREE.BackSide} />
      </mesh>
      <mesh geometry={liquidGeometry} renderOrder={10} raycast={() => null}>
        <liquidMaterial ref={liquidMatRef} args={[false]} />
      </mesh>
      <mesh ref={sedimentMeshRef} geometry={sedimentGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} renderOrder={12} raycast={() => null}>
        <meshStandardMaterial ref={sedimentMatRef} transparent depthWrite={false} roughness={0.9} />
      </mesh>
      <mesh
        ref={meniscusMeshRef}
        geometry={meniscusGeometry}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={16}
        raycast={() => null}
      >
        <liquidMaterial ref={meniscusMatRef} args={[true]} />
      </mesh>
      <mesh geometry={glassGeometry} renderOrder={20} raycast={() => null}>
        <glassRimMaterial ref={glassFrontMatRef} args={[0.06, 0.55]} side={THREE.FrontSide} />
      </mesh>
      <mesh visible={false} userData={{ objectId: id }} position={[0, hitHeight / 2, 0]}>
        <cylinderGeometry args={[hitRadius, hitRadius, hitHeight, 16]} />
        <meshBasicMaterial />
      </mesh>
      <group name="effects" />
      {children}
    </group>
  );
}
