"use client";

import dynamic from "next/dynamic";
import { WebMcpBoot } from "@/webmcp/WebMcpBoot";
import { DevConsole } from "@/webmcp/DevConsole";
import { TopBar } from "@/components/panels/TopBar";
import { ContextPanel } from "@/components/panels/ContextPanel";
import { ActivityPanel } from "@/components/feed/ActivityPanel";
import { Shelf } from "@/components/shelf/Shelf";
import { ResetDialog } from "@/components/ui/ResetDialog";

// The R3F canvas touches WebGL and `document`, so it is client-only and loaded after hydration.
const LabCanvas = dynamic(() => import("./bench/LabCanvas").then((m) => m.LabCanvas), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-bg" />,
});

/**
 * Full-viewport lab: the 3D bench underneath, translucent chrome floating above it as
 * pointer-events-auto islands over a pointer-events-none overlay, so the canvas still
 * receives clicks everywhere chrome doesn't cover (C2).
 */
export function LabShell() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-bg">
      <LabCanvas />

      <div className="pointer-events-none absolute inset-0 flex flex-col p-3">
        <TopBar />
        <div className="pointer-events-none relative min-h-0 flex-1">
          <ActivityPanel />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-stretch">
            <ContextPanel />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-1">
            <Shelf />
          </div>
        </div>
      </div>

      <ResetDialog />
      <WebMcpBoot />
      <DevConsole />
    </div>
  );
}
