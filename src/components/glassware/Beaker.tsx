import { BEAKER_PROFILE } from "@/scene/profiles";
import { Vessel } from "./Vessel";

export interface BeakerProps {
  readonly id: string;
  readonly position: readonly [number, number, number];
}

/** 250 mL beaker (C3.5): a straight-walled cylinder, no extras beyond the shared assembly. */
export function Beaker({ id, position }: BeakerProps) {
  return <Vessel id={id} profile={BEAKER_PROFILE} position={position} />;
}
