"use client";

import { ChevronDown } from "lucide-react";
import { useLabStore } from "@/store/labStore";
import { Menu } from "@/components/ui/Menu";
import type { ScenarioId } from "@/engine";

const SCENARIOS: ReadonlyArray<{ value: ScenarioId; label: string }> = [
  { value: "sandbox", label: "Sandbox" },
  { value: "titration", label: "Titration" },
  { value: "unknown_id", label: "Unknown sample" },
];

const SEED = 42;

/** Loads a scenario at the fixed demo seed. The whole bench and feed reset with it. */
export function ScenarioMenu() {
  const scenarioId = useLabStore((s) => s.lab.scenario.kind);
  const dispatch = useLabStore((s) => s.dispatch);
  const current = SCENARIOS.find((s) => s.value === scenarioId) ?? SCENARIOS[0];

  return (
    <Menu
      trigger={
        <button className="pressable flex h-7 items-center gap-1 rounded-sm px-2 text-sm font-semibold text-ink hover:bg-surface-thin">
          ChemLab
          <span className="text-ink-3">·</span>
          {current?.label}
          <ChevronDown size={13} className="text-ink-3" />
        </button>
      }
      options={SCENARIOS}
      onSelect={(value) => void dispatch({ kind: "LOAD_SCENARIO", scenarioId: value, seed: SEED }, "human")}
    />
  );
}
