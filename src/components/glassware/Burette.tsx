import { BURETTE_PROFILE } from "@/scene/profiles";
import { Vessel } from "./Vessel";
import { BuretteStand } from "./BuretteStand";

export interface BuretteProps {
  readonly id: string;
  readonly position: readonly [number, number, number];
}

const TIP_LIFT = 0.95;

/**
 * 50 mL burette on its stand (C3.5). The tube sits with its tip at y 0.95 so it clears the
 * flask below it; the stand is drawn at ground level under the same cell.
 */
export function Burette({ id, position }: BuretteProps) {
  const [x, y, z] = position;
  const lifted: readonly [number, number, number] = [x, y + TIP_LIFT, z];
  return (
    <group>
      <Vessel id={id} profile={BURETTE_PROFILE} wall={0.01} position={lifted}>
        <mesh position={[0, -0.09, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.005, 0.04, 0.18, 16]} />
          <meshStandardMaterial color="#dfe8f0" roughness={0.2} transparent opacity={0.5} />
        </mesh>
        <mesh position={[0, 0.08, 0.07]} raycast={() => null}>
          <boxGeometry args={[0.12, 0.05, 0.05]} />
          <meshStandardMaterial color="#c7ccd4" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.08, 0.07]} rotation={[0, 0, Math.PI / 2]} raycast={() => null}>
          <cylinderGeometry args={[0.02, 0.02, 0.14, 12]} />
          <meshStandardMaterial color="#c7ccd4" roughness={0.5} metalness={0.3} />
        </mesh>
      </Vessel>
      <BuretteStand position={[x, y, z]} />
    </group>
  );
}
