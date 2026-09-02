"use client";

import { assertNever, type ContainerType, type InstrumentType } from "@/engine";
import { Beaker } from "./Beaker";
import { Burette } from "./Burette";
import { Erlenmeyer } from "./Erlenmeyer";
import { GradCylinder } from "./GradCylinder";
import { Hotplate } from "./Hotplate";
import { PHMeter } from "./PHMeter";
import { TestTube } from "./TestTube";
import { Thermometer } from "./Thermometer";
import type { InstrumentProps, VesselProps } from "./types";

/** Maps a container's `type` to its flat 2D glassware component. */
export function Vessel(props: VesselProps) {
  const type: ContainerType = props.type;
  switch (type) {
    case "beaker":
      return <Beaker {...props} />;
    case "flask":
      return <Erlenmeyer {...props} />;
    case "test_tube":
      return <TestTube {...props} />;
    case "graduated_cylinder":
      return <GradCylinder {...props} />;
    case "burette":
      return <Burette {...props} />;
    default:
      return assertNever(type);
  }
}

/** Maps an instrument's `type` to its flat 2D component. */
export function Instrument(props: InstrumentProps) {
  const type: InstrumentType = props.type;
  switch (type) {
    case "ph_meter":
      return <PHMeter {...props} />;
    case "thermometer":
      return <Thermometer {...props} />;
    case "hotplate":
      return <Hotplate {...props} />;
    default:
      return assertNever(type);
  }
}
