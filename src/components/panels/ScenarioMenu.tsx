"use client";

import { ChevronDown } from "lucide-react";
import { useLabStore } from "@/store/labStore";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1 font-semibold">
            {current?.label}
            <ChevronDown size={13} className="text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent>
        {SCENARIOS.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => void dispatch({ kind: "LOAD_SCENARIO", scenarioId: option.value, seed: SEED }, "human")}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
