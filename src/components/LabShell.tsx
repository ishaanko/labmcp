"use client";

import { clsx } from "clsx";
import { Bench } from "@/lab2d/Bench";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { WebMcpBoot } from "@/webmcp/WebMcpBoot";
import { DevConsole } from "@/webmcp/DevConsole";
import { TopBar } from "@/components/panels/TopBar";
import { ContextPanel } from "@/components/panels/ContextPanel";
import { ActivityPanel } from "@/components/feed/ActivityPanel";
import { Shelf } from "@/components/shelf/Shelf";
import { BENCH_VIEWPORT_ID } from "@/components/shelf/useShelfDrag";
import { Dialogs } from "@/components/dialogs/Dialogs";
import { ExplainSheet } from "@/components/panels/ExplainSheet";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useLabStore } from "@/store/labStore";

/**
 * Full-viewport lab: a flat top bar, a left activity rail, the 2D bench filling the center with
 * the reagent dock floating over its bottom edge, and a fixed-width right context panel. The
 * agent panel and every dialog mount alongside, each gating on its own store flag. The agent
 * panel is a 380px sheet over the right edge with no backdrop; it covers the 320px context panel
 * plus 60px of the bench column, so while it is open the bench viewport and the dock give up
 * those 60px and the objects re-center in the space that is still visible.
 */
export function LabShell() {
  const agentPanelOpen = useLabStore((s) => s.ui.agentPanelOpen);
  const toggleAgentPanel = useLabStore((s) => s.toggleAgentPanel);
  useKeyboard();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      <TopBar />

      <div className="flex min-h-0 flex-1">
        <ActivityPanel />

        <div className="relative min-h-0 flex-1">
          <div className={clsx("absolute inset-0", agentPanelOpen && "right-[60px]")}>
            <div id={BENCH_VIEWPORT_ID} className="absolute inset-0 overflow-hidden">
              <Bench />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
              <Shelf />
            </div>
          </div>
        </div>

        <ContextPanel />
      </div>

      <AgentPanel open={agentPanelOpen} onOpenChange={toggleAgentPanel} />

      <Dialogs />
      <ExplainSheet />
      <WebMcpBoot />
      <DevConsole />
    </div>
  );
}
