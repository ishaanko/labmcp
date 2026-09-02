"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLabStore } from "@/store/labStore";
import { selectLastAgentTarget, selectPublic } from "@/store/selectors";
import { CELL_H, cellToPx } from "../grid";

const LINGER_MS = 2400;

/** An amber chip above the bench object the last agent tool call acted on, e.g. "dispense 2.0 mL". */
export function AgentMarker() {
  const target = useLabStore(selectLastAgentTarget);
  const objects = useLabStore((s) => selectPublic(s).objects);
  // The most recent target `ts` that has finished lingering; a fresh target is visible the
  // instant it arrives (derived from props, no state needed), and this only tracks *expiry*.
  const [expiredTs, setExpiredTs] = useState<number | null>(null);

  useEffect(() => {
    if (!target) return undefined;
    const ts = target.ts;
    const timeout = window.setTimeout(() => setExpiredTs(ts), LINGER_MS);
    return () => window.clearTimeout(timeout);
  }, [target]);

  const visible = target !== null && target.ts !== expiredTs;
  const object = target && visible ? objects.find((o) => o.id === target.targetId) : undefined;

  return (
    <AnimatePresence>
      {object && target && (
        <motion.div
          key="agent-marker"
          className="pointer-events-none absolute left-0 top-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, x: cellToPx(object.position).x, y: cellToPx(object.position).y - CELL_H / 2 - 30 }}
          exit={{ opacity: 0 }}
          transition={{
            x: { type: "spring", visualDuration: 0.35, bounce: 0.2 },
            y: { type: "spring", visualDuration: 0.35, bounce: 0.2 },
            opacity: { duration: 0.12 },
          }}
        >
          <div className="-translate-x-1/2 whitespace-nowrap rounded-md bg-amber px-2 py-1 text-xs font-medium tabular-nums text-black">
            {target.label}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
