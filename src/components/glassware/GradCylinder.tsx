import { GRAD_CYLINDER_PROFILE } from "@/scene/profiles";
import { Vessel } from "./Vessel";

export interface GradCylinderProps {
  readonly id: string;
  readonly position: readonly [number, number, number];
}

/** 100 mL graduated cylinder (C3.5): tall, narrow, with a hexagonal foot. */
export function GradCylinder({ id, position }: GradCylinderProps) {
  return (
    <Vessel id={id} profile={GRAD_CYLINDER_PROFILE} position={position}>
      <mesh position={[0, 0.03, 0]} renderOrder={1} raycast={() => null}>
        <cylinderGeometry args={[0.3, 0.3, 0.06, 6]} />
        <meshStandardMaterial color="#dfe8f0" roughness={0.4} transparent opacity={0.5} />
      </mesh>
    </Vessel>
  );
}
