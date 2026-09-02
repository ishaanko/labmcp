"use client";

import { useRef, useState } from "react";
import { Flame, Snowflake } from "lucide-react";
import type { Container, Instrument } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { Readout } from "@/components/ui-legacy/Readout";
import { ChipButton } from "@/components/ui-legacy/Chip";
import { Slider } from "@/components/ui-legacy/Slider";
import { observe } from "@/components/ui-legacy/toasts";

export interface HotplateCardProps {
  readonly instrument: Instrument;
}

const PRESETS: ReadonlyArray<{ readonly label: string; readonly targetC: number | null }> = [
  { label: "Off", targetC: null },
  { label: "40", targetC: 40 },
  { label: "60", targetC: 60 },
  { label: "80", targetC: 80 },
  { label: "100", targetC: 100 },
];

const SLIDER_MIN = 20;
const SLIDER_MAX = 110;

function isContainer(o: Container | Instrument): o is Container {
  return o.kind === "container";
}

/**
 * Right-panel card for a selected hotplate (C4.7): target chips and a slider heat the
 * container currently sitting in the hotplate's cell. With nothing in the cell, both toast
 * instead of dispatching.
 */
export function HotplateCard({ instrument }: HotplateCardProps) {
  const dispatch = useLabStore((s) => s.dispatch);
  const container = useLabStore((s) => s.lab.objects.find((o) => isContainer(o) && o.position.x === instrument.position.x && o.position.y === instrument.position.y)) as
    | Container
    | undefined;

  const thermal = container?.thermal ?? { kind: "idle" as const };
  const dialTargetC = thermal.kind === "idle" ? SLIDER_MIN : thermal.targetC;
  const [sliderValue, setSliderValue] = useState(dialTargetC);
  // Re-syncs the slider's local echo when the engine's own target moves (dial commit, chip
  // press, or an agent tool call) without an effect-driven cascading render.
  const lastDialTargetC = useRef(dialTargetC);
  if (lastDialTargetC.current !== dialTargetC) {
    lastDialTargetC.current = dialTargetC;
    setSliderValue(dialTargetC);
  }

  const applyTarget = (targetC: number | null): void => {
    if (!container) {
      observe({ kind: "info", title: "Nothing on the hotplate.", description: "Drag a container onto this cell first." });
      return;
    }
    if (targetC === null) void dispatch({ kind: "COOL", containerId: container.id }, "human");
    else void dispatch({ kind: "HEAT", containerId: container.id, targetC }, "human");
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-md font-semibold text-ink">Hotplate</h2>
        <p className="text-2xs text-ink-3">{container ? `Heating ${container.label}` : "Empty"}</p>
      </div>

      <Readout label="Plate temperature" value={container?.temperatureC ?? null} unit="°C" digits={1} />

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <ChipButton
            key={preset.label}
            active={preset.targetC === null ? thermal.kind === "idle" : thermal.kind !== "idle" && thermal.targetC === preset.targetC}
            onClick={() => applyTarget(preset.targetC)}
          >
            {preset.targetC === null ? <Snowflake size={12} /> : <Flame size={12} />}
            {preset.label}
          </ChipButton>
        ))}
      </div>

      <div>
        <p className="text-2xs text-ink-3">Target: {sliderValue.toFixed(0)} °C</p>
        <Slider
          aria-label="Hotplate target temperature"
          value={sliderValue}
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={1}
          onChange={setSliderValue}
          onCommit={(v) => applyTarget(Math.round(v))}
        />
      </div>
    </div>
  );
}
