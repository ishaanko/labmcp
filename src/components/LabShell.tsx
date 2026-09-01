"use client";

import dynamic from "next/dynamic";

// The R3F canvas touches WebGL and `document`, so it is client-only and loaded after hydration.
const LabCanvas = dynamic(() => import("./bench/LabCanvas").then((m) => m.LabCanvas), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-bg" />,
});

/** Composes the full-viewport lab: 3D bench underneath, translucent chrome floating above. */
export function LabShell() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-bg">
      <LabCanvas />
    </div>
  );
}
