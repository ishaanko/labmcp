import { TEST_TUBE_PROFILE } from "@/scene/profiles";
import { Vessel } from "./Vessel";

export interface TestTubeProps {
  readonly id: string;
  readonly position: readonly [number, number, number];
}

/** 20 mL test tube (C3.5): a single tube. The rack that holds several lives separately. */
export function TestTube({ id, position }: TestTubeProps) {
  return <Vessel id={id} profile={TEST_TUBE_PROFILE} wall={0.01} position={position} />;
}
