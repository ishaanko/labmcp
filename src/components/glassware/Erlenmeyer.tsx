import { ERLENMEYER_PROFILE } from "@/scene/profiles";
import { Vessel } from "./Vessel";

export interface ErlenmeyerProps {
  readonly id: string;
  readonly position: readonly [number, number, number];
}

/** 250 mL Erlenmeyer flask (C3.5): the "flask" container type, conical, narrow neck. */
export function Erlenmeyer({ id, position }: ErlenmeyerProps) {
  return <Vessel id={id} profile={ERLENMEYER_PROFILE} position={position} />;
}
