"use client";

import { useSyncExternalStore } from "react";
import { Undo2, RotateCcw, TerminalSquare } from "lucide-react";
import { useLabStore } from "@/store/labStore";
import { Button } from "@/components/ui/Button";
import { ScenarioMenu } from "./ScenarioMenu";
import { ObjectiveChip } from "./ObjectiveChip";
import { WebMcpPill } from "./WebMcpPill";

/** `?console=1` never changes after load, so there is nothing to subscribe to; only the read differs. */
function subscribeNever(): () => void {
  return () => {};
}

function readConsoleParam(): boolean {
  return new URLSearchParams(window.location.search).get("console") === "1";
}

/** Server snapshot is always false: there is no URL to read during SSR, and the client's first
 * render must match it exactly or React logs a hydration mismatch. */
function readConsoleParamServer(): boolean {
  return false;
}

/** True when `?console=1` is on the URL. False on the server and on the client's first paint. */
function useConsoleParamPresent(): boolean {
  return useSyncExternalStore(subscribeNever, readConsoleParam, readConsoleParamServer);
}

/** Flat 40px top strip, edge to edge: wordmark + scenario, objective text, undo/reset, WebMCP status. */
export function TopBar() {
  const historyLength = useLabStore((s) => s.lab.history.length);
  const dispatch = useLabStore((s) => s.dispatch);
  const openDialog = useLabStore((s) => s.openDialog);
  const toggleDevConsole = useLabStore((s) => s.toggleDevConsole);
  const consoleEnabled = useConsoleParamPresent();

  return (
    <div className="topbar pointer-events-auto flex h-10 w-full items-center gap-2 px-3">
      <ScenarioMenu />
      <ObjectiveChip />
      <div className="flex-1" />
      {consoleEnabled ? (
        <Button variant="ghost" size="sm" onClick={toggleDevConsole} aria-label="Toggle dev console">
          <TerminalSquare size={14} />
          Console
        </Button>
      ) : null}
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
