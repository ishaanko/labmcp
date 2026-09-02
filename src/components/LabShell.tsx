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
 * agent panel and every dialog mount alongside, each gating on its own store flag. While the
 * agent panel is open the bench viewport gives up its right 380px so the objects re-center in
 * the space that is still visible.
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
          <div id={BENCH_VIEWPORT_ID} className={clsx("absolute inset-0 overflow-hidden", agentPanelOpen && "right-[380px]")}>
            <Bench />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
            <Shelf />
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
