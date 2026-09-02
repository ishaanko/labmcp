"use client";

import { Pipette, Waves, Trash2, Unlink } from "lucide-react";
import { emitToast } from "@/lib/events";
import { useLabStore } from "@/store/labStore";
import { selectContainers } from "@/store/selectors";
import type { Instrument, PublicContainer } from "@/engine";
import { constants, describeColor, speciesDef } from "@/engine";
import { Readout } from "@/components/ui/Readout";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";

export interface SelectionCardProps {
  object: PublicContainer | Instrument;
}

/** Right-panel card for the selected vessel or instrument (C2, C4.1). */
export function SelectionCard({ object }: SelectionCardProps) {
  if (object.kind === "instrument") return <InstrumentCard instrument={object} />;
  return <ContainerCard container={object} />;
}

/** The bench's titration-style layout puts a burette one row behind (same x, y - 1) its flask. */
function buretteBehind(container: PublicContainer, containers: ReadonlyArray<PublicContainer>): PublicContainer | undefined {
  return containers.find(
    (c) => c.type === "burette" && c.volumeMl > 0 && c.position.x === container.position.x && container.position.y - c.position.y === 1,
  );
}

function ContainerCard({ container }: { container: PublicContainer }) {
  const dispatch = useLabStore((s) => s.dispatch);
  const dispenseIncrementMl = useLabStore((s) => s.ui.dispenseIncrementMl);
  const containers = useLabStore(selectContainers);
  const burette = buretteBehind(container, containers);

  const dispenseHere = (): void => {
    if (!burette) return;
    void dispatch({ kind: "DISPENSE", buretteId: burette.id, toId: container.id, volumeMl: dispenseIncrementMl }, "human");
  };
  const stir = (): void => void dispatch({ kind: "STIR", containerId: container.id, durationS: constants.DEFAULT_STIR_S }, "human");
  const dispose = (): void => {
    const label = container.label;
    void dispatch({ kind: "DISPOSE", containerId: container.id }, "human").then((res) => {
      if (!res.ok) return;
      emitToast({
        kind: "info",
        title: `Disposed contents of ${label}`,
        action: { label: "Undo", onClick: () => void dispatch({ kind: "UNDO" }, "human") },
      });
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h2 className="text-md font-semibold text-ink">{container.label}</h2>
        <p className="text-2xs text-ink-3">{container.type.replace("_", " ")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Readout label="Volume" value={container.volumeMl} unit="mL" digits={2} />
        <Readout label="Temperature" value={container.temperatureC} unit="°C" digits={1} />
        <Readout label="pH" value={container.pH} digits={2} emptyLabel="no probe" />
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

      {container.solids.length > 0 ? (
        <div>
          <p className="text-2xs text-ink-3">Solids</p>
          <ul className="mt-1 flex flex-col gap-1">
            {container.solids.map((solid, i) => (
              <li key={solid.kind === "identified" ? solid.species : `redacted-${i}`} className="flex items-center gap-1.5 text-sm text-ink">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: `rgba(${solid.color.r}, ${solid.color.g}, ${solid.color.b}, ${solid.color.a})` }}
                  aria-hidden
                />
                {solid.kind === "identified" ? (
                  speciesDef(solid.species).name
                ) : (
                  <span>
                    {describeColor(solid.color)} precipitate, {solid.scale}
                  </span>
                )}
                <span className="text-ink-3">{solid.suspended > 0.5 ? "suspended" : "settled"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
        {burette ? (
          <Button size="sm" onClick={dispenseHere}>
            <Pipette size={13} />
            Dispense here
          </Button>
        ) : null}
        <Button size="sm" onClick={stir}>
          <Waves size={13} />
          Stir
        </Button>
        <Button size="sm" variant="ghost" className="text-danger" onClick={dispose}>
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
