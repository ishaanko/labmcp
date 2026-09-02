import { assertNever, type Container, type Instrument } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { profileForContainerType, radiusAt } from "@/scene/profiles";
import { gridToWorld } from "./Bench";
import { Beaker } from "@/components/glassware/Beaker";
import { Erlenmeyer } from "@/components/glassware/Erlenmeyer";
import { TestTube } from "@/components/glassware/TestTube";
import { GradCylinder } from "@/components/glassware/GradCylinder";
import { Burette } from "@/components/glassware/Burette";
import { PHProbe, type RimPose } from "@/components/glassware/PHProbe";
import { Thermometer } from "@/components/glassware/Thermometer";
import { Hotplate } from "@/components/glassware/Hotplate";

const HOTPLATE_TOP_Y = 0.12;

/** Rim pose for an attached probe/thermometer (C3.5): at the rim, tilted inward, near the liquid top. */
function attachRimPose(container: Container, mirror: boolean): RimPose {
  const profile = profileForContainerType(container.type);
  const [cx, cy, cz] = gridToWorld(container.position);
  const r = radiusAt(profile, profile.capacityHeight);
  const angle = mirror ? Math.PI * 0.75 : Math.PI * 0.25;
  const tiltRad = ((mirror ? -1 : 1) * 12 * Math.PI) / 180;
  return {
    x: cx + Math.cos(angle) * r * 0.85,
    y: cy + profile.capacityHeight - 0.15,
    z: cz + Math.sin(angle) * r * 0.85,
    tiltRad,
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
          attachedRim={attached ? attachRimPose(attached, false) : null}
        />
      );
    case "thermometer":
      return (
        <Thermometer
          key={instrument.id}
          id={instrument.id}
          position={position}
          attachedRim={attached ? attachRimPose(attached, true) : null}
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
      {containers.map((container) => {
        const restsOnHotplate = hotplates.some((h) => h.position.x === container.position.x && h.position.y === container.position.y);
        return renderContainer(container, restsOnHotplate);
      })}
      {instruments.map((instrument) => renderInstrument(instrument, containers))}
    </group>
  );
}
