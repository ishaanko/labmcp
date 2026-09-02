"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLabStore } from "@/store/labStore";
import { selectLastAgentTarget, selectPublic } from "@/store/selectors";
import { CELL_W, cellToPx, dockedInstrumentPx, type XY } from "../grid";

const LINGER_MS = 2400;

/** An amber chip at the right edge of the bench object the last agent tool call acted on, e.g. "dispense 2.0 mL". Beside, not above: above a flask is where its burette tip hangs. */
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
  const host = object && object.kind === "instrument" && object.attachedTo !== null ? objects.find((o) => o.id === object.attachedTo) : undefined;
  // A docked instrument is drawn at its host's cell corner, not at its own cell.
  const anchor: XY | null = !object ? null : host ? dockedInstrumentPx(host.position) : cellToPx(object.position);
  const chipPx: XY | null = anchor === null ? null : host ? { x: anchor.x + 36, y: anchor.y - 12 } : { x: anchor.x + CELL_W / 2 - 6, y: anchor.y - 12 };

  return (
    <AnimatePresence>
      {chipPx && target && (
        <motion.div
          key="agent-marker"
          className="pointer-events-none absolute left-0 top-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, x: chipPx.x, y: chipPx.y }}
          exit={{ opacity: 0 }}
          transition={{
            x: { type: "spring", visualDuration: 0.35, bounce: 0.2 },
            y: { type: "spring", visualDuration: 0.35, bounce: 0.2 },
            opacity: { duration: 0.12 },
          }}
        >
          <div className="whitespace-nowrap rounded-md bg-amber px-2 py-1 text-xs font-medium tabular-nums text-black">
            {target.label}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
