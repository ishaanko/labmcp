"use client";

import { Check, ChevronDown } from "lucide-react";
import { useLabStore } from "@/store/labStore";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SCENARIO_IDS, SCENARIO_TITLES } from "@/engine";

const SEED = 42;

/** Loads a scenario at the fixed demo seed; the current one is ticked. The whole bench and feed reset with it. */
export function ScenarioMenu() {
  const scenarioId = useLabStore((s) => s.lab.scenario.kind);
  const dispatch = useLabStore((s) => s.dispatch);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1 font-semibold">
            {SCENARIO_TITLES[scenarioId]}
            <ChevronDown size={13} className="text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent>
        {SCENARIO_IDS.map((id) => (
          <DropdownMenuItem key={id} aria-current={id === scenarioId} onClick={() => void dispatch({ kind: "LOAD_SCENARIO", scenarioId: id, seed: SEED }, "human")}>
            {SCENARIO_TITLES[id]}
            {id === scenarioId ? <Check size={13} className="ml-auto text-muted-foreground" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
