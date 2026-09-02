"use client";

import { Pipette, Waves, Trash2, Unlink } from "lucide-react";
import { emitToast } from "@/lib/events";
import { formatFormula } from "@/lib/format";
import { labelFor } from "@/lib/labels";
import { useLabStore } from "@/store/labStore";
import { selectContainers } from "@/store/selectors";
import type { Instrument, PublicContainer, PublicSolidDeposit, SpeciesId } from "@/engine";
import { constants, describeColor, REAGENTS, speciesDef } from "@/engine";
import { Readout } from "./Readout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface SelectionCardProps {
  object: PublicContainer | Instrument;
}

/** Right-panel card for the selected vessel or instrument. */
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
        <h2 className="text-base font-semibold text-foreground">{container.label}</h2>
        <p className="text-xs text-muted-foreground">{container.type.replace("_", " ")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Readout label="Volume" value={container.volumeMl} unit="mL" digits={2} />
        <Readout label="Temperature" value={container.temperatureC} unit="°C" digits={1} />
        <Readout label="pH" value={container.pH} digits={2} emptyLabel="no probe" />
        <Readout label="Capacity" value={container.capacityMl} unit="mL" digits={0} />
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Contents</p>
        {container.contents.kind === "visible" ? (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {Object.keys(container.contents.species).map((species) => (
              <Badge key={species} variant="outline">
                {formatFormula(species)}
              </Badge>
            ))}
            {Object.keys(container.contents.species).length === 0 ? <span className="text-sm text-muted-foreground">Empty</span> : null}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Hidden in this challenge</p>
        )}
      </div>

      {container.solids.length > 0 ? (
        <div>
          <p className="text-xs text-muted-foreground">Solids</p>
          <ul className="mt-1 flex flex-col gap-1">
            {container.solids.map((solid, i) => (
              <SolidRow key={solid.kind === "identified" ? solid.species : `redacted-${i}`} solid={solid} container={container} />
            ))}
          </ul>
        </div>
      ) : null}

      {container.indicators.length > 0 ? (
        <div>
          <p className="text-xs text-muted-foreground">Indicators</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {container.indicators.map((dose) => (
              <Badge key={dose.indicator} variant="outline">
                {dose.indicator} · {dose.drops} drops
              </Badge>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
        {burette ? (
          <Button size="sm" onClick={dispenseHere}>
            <Pipette size={13} />
            Dispense here
          </Button>
        ) : null}
        <Button size="sm" variant="secondary" onClick={stir}>
          <Waves size={13} />
          Stir
        </Button>
        <Button size="sm" variant="destructive" onClick={dispose}>
          <Trash2 size={13} />
          Dispose
        </Button>
      </div>
    </div>
  );
}

/** The dry-solid reagent whose `solidSpecies` matches, if this deposit came from a mass dose rather than a reaction. */
function solidReagentFor(species: SpeciesId) {
  return REAGENTS.find((r) => r.kind === "solid" && r.solidSpecies === species);
}

/** One undissolved-solid line: a dosed reagent reads as "Undissolved: 1.8 g potassium nitrate" plus its dissolved ion concentration; a reaction precipitate keeps the formula/name line. */
function SolidRow({ solid, container }: { solid: PublicSolidDeposit; container: PublicContainer }) {
  const swatch = (
    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `rgba(${solid.color.r}, ${solid.color.g}, ${solid.color.b}, ${solid.color.a})` }} aria-hidden />
  );
  const settled = <span className="text-muted-foreground">{solid.suspended > 0.5 ? "suspended" : "settled"}</span>;

  if (solid.kind !== "identified") {
    return (
      <li className="flex items-center gap-1.5 text-sm text-foreground">
        {swatch}
        <span>
          {describeColor(solid.color)} precipitate, {solid.scale}
        </span>
        {settled}
      </li>
    );
  }

  const reagent = solidReagentFor(solid.species);
  if (!reagent || reagent.kind !== "solid") {
    return (
      <li className="flex items-center gap-1.5 text-sm text-foreground">
        {swatch}
        {formatFormula(solid.species)} {speciesDef(solid.species).name}
        {settled}
      </li>
    );
  }

  const undissolvedG = solid.moles * reagent.molarMass;
  const trackedIon = reagent.ions[0];
  const dissolvedM = trackedIon && container.contents.kind === "visible" ? container.contents.concentrationsM[trackedIon.species] : undefined;

  return (
    <li className="flex flex-col gap-0.5 text-sm text-foreground">
      <span className="flex items-center gap-1.5">
        {swatch}
        Undissolved: {undissolvedG.toFixed(1)} g {speciesDef(solid.species).name}
        {settled}
      </span>
      {dissolvedM !== undefined && trackedIon ? (
        <span className="ml-3 text-xs text-muted-foreground">
          Dissolved: {dissolvedM.toFixed(3)} M {formatFormula(trackedIon.species)}
        </span>
      ) : null}
    </li>
  );
}

function InstrumentCard({ instrument }: { instrument: Instrument }) {
  const dispatch = useLabStore((s) => s.dispatch);
  const title = useLabStore((s) => labelFor(s.lab, instrument.id));
  const attachedLabel = useLabStore((s) => (instrument.attachedTo ? labelFor(s.lab, instrument.attachedTo) : null));
  const detach = (): void => void dispatch({ kind: "ATTACH_INSTRUMENT", instrumentId: instrument.id, containerId: null }, "human");

  const readingValue =
    instrument.lastReading?.kind === "ph" ? instrument.lastReading.value : instrument.lastReading?.kind === "temperature" ? instrument.lastReading.valueC : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{attachedLabel ? `Attached to ${attachedLabel}` : "Unattached"}</p>
      </div>
      <Readout label="Last reading" value={readingValue} digits={2} />
      {instrument.attachedTo ? (
        <Button size="sm" variant="secondary" onClick={detach} className="w-fit">
          <Unlink size={13} />
          Detach
        </Button>
      ) : null}
    </div>
  );
}
