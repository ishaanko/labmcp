"use client";

import { Droplets, Waves, Flame, Trash2, Unlink } from "lucide-react";
import { useLabStore } from "@/store/labStore";
import type { Instrument, PublicContainer } from "@/engine";
import { constants } from "@/engine";
import { Readout } from "@/components/ui/Readout";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { observe } from "@/components/ui/toasts";

export interface SelectionCardProps {
  object: PublicContainer | Instrument;
}

/** Right-panel card for the selected vessel or instrument (C2, C4.1). */
export function SelectionCard({ object }: SelectionCardProps) {
  if (object.kind === "instrument") return <InstrumentCard instrument={object} />;
  return <ContainerCard container={object} />;
}

function ContainerCard({ container }: { container: PublicContainer }) {
  const dispatch = useLabStore((s) => s.dispatch);

  const pour = (): void => observe({ kind: "info", title: "Drag this vessel onto another container to pour." });
  const stir = (): void => void dispatch({ kind: "STIR", containerId: container.id, durationS: constants.DEFAULT_STIR_S }, "human");
  const heat = (): void =>
    void dispatch(
      container.thermal.kind === "heating"
        ? { kind: "COOL", containerId: container.id }
        : { kind: "HEAT", containerId: container.id, targetC: 60 },
      "human",
    );
  const dispose = (): void => void dispatch({ kind: "DISPOSE", containerId: container.id }, "human");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h2 className="text-md font-semibold text-ink">{container.label}</h2>
        <p className="text-2xs text-ink-3">{container.type.replace("_", " ")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Readout label="Volume" value={container.volumeMl} unit="mL" digits={2} />
        <Readout label="Temperature" value={container.temperatureC} unit="°C" digits={1} />
        <Readout label="pH" value={container.pH} digits={2} />
        <Readout label="Capacity" value={container.capacityMl} unit="mL" digits={0} />
      </div>

      <div>
        <p className="text-2xs text-ink-3">Contents</p>
        {container.contents.kind === "visible" ? (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {Object.keys(container.contents.species).map((species) => (
              <Chip key={species} size="sm">
                {species}
              </Chip>
            ))}
            {Object.keys(container.contents.species).length === 0 ? <span className="text-sm text-ink-3">Empty</span> : null}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-ink-3">Hidden in this challenge</p>
        )}
      </div>

      {container.indicators.length > 0 ? (
        <div>
          <p className="text-2xs text-ink-3">Indicators</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {container.indicators.map((dose) => (
              <Chip key={dose.indicator} size="sm">
                {dose.indicator} · {dose.drops} drops
              </Chip>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2 border-t border-hairline pt-3">
        <Button size="sm" onClick={pour}>
          <Droplets size={13} />
          Pour
        </Button>
        <Button size="sm" onClick={stir}>
          <Waves size={13} />
          Stir
        </Button>
        <Button size="sm" onClick={heat}>
          <Flame size={13} />
          {container.thermal.kind === "heating" ? "Stop heat" : "Heat"}
        </Button>
        <Button size="sm" variant="danger" onClick={dispose}>
          <Trash2 size={13} />
          Dispose
        </Button>
      </div>
    </div>
  );
}

function InstrumentCard({ instrument }: { instrument: Instrument }) {
  const dispatch = useLabStore((s) => s.dispatch);
  const detach = (): void => void dispatch({ kind: "ATTACH_INSTRUMENT", instrumentId: instrument.id, containerId: null }, "human");

  const readingValue =
    instrument.lastReading?.kind === "ph"
      ? instrument.lastReading.value
      : instrument.lastReading?.kind === "temperature"
        ? instrument.lastReading.valueC
        : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-md font-semibold text-ink">{instrument.type.replace("_", " ")}</h2>
        <p className="text-2xs text-ink-3">{instrument.attachedTo ? `Attached to ${instrument.attachedTo}` : "Unattached"}</p>
      </div>
      <Readout label="Last reading" value={readingValue} digits={2} />
      {instrument.attachedTo ? (
        <Button size="sm" onClick={detach} className="w-fit">
          <Unlink size={13} />
          Detach
        </Button>
      ) : null}
    </div>
  );
}
