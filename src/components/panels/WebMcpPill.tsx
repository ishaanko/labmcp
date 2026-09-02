"use client";

import { useEffect, useRef } from "react";
import { animate } from "motion/react";
import { Zap } from "lucide-react";
import { clsx } from "clsx";
import { useLabStore } from "@/store/labStore";

const PROVIDER_LABEL: Record<"native" | "polyfill" | "none", string> = {
  native: "native",
  polyfill: "polyfill",
  none: "offline",
};

/** WebMCP status pill. Scales once, 300ms, on every agent tool call (C6). */
export function WebMcpPill() {
  const webmcp = useLabStore((s) => s.ui.webmcp);
  const lastAgentCallId = useLabStore((s) => {
    const top = s.feed[0];
    return top && top.source === "agent" && top.kind === "tool_call" ? top.id : null;
  });
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (!lastAgentCallId || lastAgentCallId === seen.current || !ref.current) return;
    seen.current = lastAgentCallId;
    if (useLabStore.getState().ui.reducedMotion) return;
    void animate(ref.current, { transform: ["scale(1)", "scale(1.04)", "scale(1)"] }, { duration: 0.3, ease: [0.23, 1, 0.32, 1] });
  }, [lastAgentCallId]);

  return (
    <span
      ref={ref}
      className={clsx(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium leading-none",
        webmcp.provider === "none" ? "border-hairline bg-surface-thin text-warn" : "border-hairline bg-surface-thin text-ok",
      )}
    >
      <Zap size={12} />
      {webmcp.toolCount} tools · {PROVIDER_LABEL[webmcp.provider]}
    </span>
  );
}
