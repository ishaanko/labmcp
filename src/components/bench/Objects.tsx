import { assertNever, type Container, type Instrument } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { profileForContainerType, radiusAt } from "@/scene/profiles";
import { HOTPLATE_TOP_Y, isOnHotplate } from "@/scene/layout";
import { gridToWorld } from "./Bench";
import { Beaker } from "@/components/glassware/Beaker";
import { Erlenmeyer } from "@/components/glassware/Erlenmeyer";
import { TestTube } from "@/components/glassware/TestTube";
import { GradCylinder } from "@/components/glassware/GradCylinder";
import { Burette } from "@/components/glassware/Burette";
import { PHProbe, type RimPose } from "@/components/glassware/PHProbe";
import { Thermometer } from "@/components/glassware/Thermometer";
import { Hotplate } from "@/components/glassware/Hotplate";
import { Effects } from "./effects/Effects";

const THERMOMETER_ANGLE_RAD = Math.PI * 0.75;
const THERMOMETER_TILT_RAD = (-12 * Math.PI) / 180;
/** Rear-right quadrant (negative z, away from the camera), so the meter box swings back behind
 * the flask's shoulder instead of over its base (C3.5 / scene-composition review). */
const PH_PROBE_ANGLE_RAD = -Math.PI * 0.25;
const PH_PROBE_TILT_RAD = (12 * Math.PI) / 180;

/** Rim pose for an attached probe/thermometer (C3.5): at the rim, tilted inward, near the liquid
 * top. `yawRad` turns the instrument's body to face `angleRad`'s outward direction, so a probe's
 * meter box (offset along its own local +x) swings away from the vessel instead of into it. */
function attachRimPose(container: Container, angleRad: number, tiltRad: number): RimPose {
  const profile = profileForContainerType(container.type);
  const [cx, cy, cz] = gridToWorld(container.position);
  const r = radiusAt(profile, profile.capacityHeight);
  return {
    x: cx + Math.cos(angleRad) * r * 0.85,
    y: cy + profile.capacityHeight - 0.15,
    z: cz + Math.sin(angleRad) * r * 0.85,
    tiltRad,
    yawRad: -angleRad,
  };
}

function renderContainer(container: Container, restsOnHotplate: boolean) {
  const [x, , z] = gridToWorld(container.position);
  const position: readonly [number, number, number] = [x, restsOnHotplate ? HOTPLATE_TOP_Y : 0, z];
  switch (container.type) {
    case "beaker":
      return <Beaker key={container.id} id={container.id} position={position} />;
    case "flask":
      return <Erlenmeyer key={container.id} id={container.id} position={position} />;
    case "test_tube":
      return <TestTube key={container.id} id={container.id} position={position} />;
    case "graduated_cylinder":
      return <GradCylinder key={container.id} id={container.id} position={position} />;
    case "burette":
      return <Burette key={container.id} id={container.id} position={position} />;
    default:
      return assertNever(container.type);
  }
}

function renderInstrument(instrument: Instrument, containers: ReadonlyArray<Container>) {
  const attached = instrument.attachedTo ? containers.find((c) => c.id === instrument.attachedTo) : undefined;
  const [x, y, z] = gridToWorld(instrument.position);
  const position: readonly [number, number, number] = [x, y, z];

  switch (instrument.type) {
    case "ph_meter":
      return (
        <PHProbe
          key={instrument.id}
          id={instrument.id}
          position={position}
          attachedRim={attached ? attachRimPose(attached, PH_PROBE_ANGLE_RAD, PH_PROBE_TILT_RAD) : null}
        />
      );
    case "thermometer":
      return (
        <Thermometer
          key={instrument.id}
          id={instrument.id}
          position={position}
          attachedRim={attached ? attachRimPose(attached, THERMOMETER_ANGLE_RAD, THERMOMETER_TILT_RAD) : null}
          attachedContainerId={attached?.id ?? null}
        />
      );
    case "hotplate": {
      const heated = containers.find((c) => c.position.x === instrument.position.x && c.position.y === instrument.position.y);
      return <Hotplate key={instrument.id} id={instrument.id} position={position} heatedContainerId={heated?.id ?? null} />;
    }
    default:
      return assertNever(instrument.type);
  }
}

/** Maps `lab.objects` to their glassware/instrument components (C3.2 layout, C3.5 table). */
export function Objects() {
  const objects = useLabStore((s) => s.lab.objects);
  const containers = objects.filter((o): o is Container => o.kind === "container");
  const instruments = objects.filter((o): o is Instrument => o.kind === "instrument");
  const hotplates = instruments.filter((i) => i.type === "hotplate");

  return (
    <group>
      {containers.map((container) => renderContainer(container, isOnHotplate(container, hotplates)))}
      {instruments.map((instrument) => renderInstrument(instrument, containers))}
      <Effects />
    </group>
  );
}
