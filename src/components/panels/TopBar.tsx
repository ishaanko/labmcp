"use client";

import { Undo2, RotateCcw } from "lucide-react";
import { useLabStore } from "@/store/labStore";
import { Button } from "@/components/ui/Button";
import { ScenarioMenu } from "./ScenarioMenu";
import { ObjectiveChip } from "./ObjectiveChip";
import { WebMcpPill } from "./WebMcpPill";

/** 44px top bar, always visible: scenario, objective, undo/reset, WebMCP status. */
export function TopBar() {
  const historyLength = useLabStore((s) => s.lab.history.length);
  const dispatch = useLabStore((s) => s.dispatch);
  const openDialog = useLabStore((s) => s.openDialog);

  return (
    <div className="material-thin pointer-events-auto flex h-11 items-center gap-2 px-3">
      <ScenarioMenu />
      <ObjectiveChip />
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="sm"
        disabled={historyLength === 0}
        onClick={() => void dispatch({ kind: "UNDO" }, "human")}
        aria-label="Undo"
      >
        <Undo2 size={14} />
        Undo
      </Button>
      <Button variant="ghost" size="sm" onClick={() => openDialog({ kind: "confirm_reset" })} aria-label="Reset">
        <RotateCcw size={14} />
        Reset
      </Button>
      <WebMcpPill />
    </div>
  );
}
