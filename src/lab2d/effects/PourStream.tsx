"use client";

import { motion } from "motion/react";
import { useLabStore } from "@/store/labStore";
import { selectPublic } from "@/store/selectors";
import { CELL_H, cellToPx, type XY } from "../grid";
import { useEffectsStore } from "../effectsStore";

const STROKE = "rgba(230, 230, 238, 0.9)";
const DRAW_S = 0.24;
const FADE_S = 0.16;

/** Near a container's rim, where a poured stream leaves the glass. */
function lipPoint(position: { x: number; y: number }): XY {
  const c = cellToPx(position);
  return { x: c.x, y: c.y - CELL_H / 2 + 18 };
}

/** Near a container's liquid surface, rising toward the rim as it fills. */
function meniscusPoint(position: { x: number; y: number }, volumeMl: number, capacityMl: number): XY {
  const c = cellToPx(position);
  const fill = capacityMl > 0 ? Math.min(1, volumeMl / capacityMl) : 0;
  return { x: c.x, y: c.y + CELL_H / 2 - 24 - fill * (CELL_H - 60) };
}

function StreamLine({ from, to }: { from: XY; to: XY }) {
  const d = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      <motion.path
        d={d}
        stroke={STROKE}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 1 }}
        animate={{ pathLength: 1, opacity: [1, 1, 0] }}
        transition={{ pathLength: { duration: DRAW_S, ease: "easeOut" }, opacity: { duration: DRAW_S + FADE_S, times: [0, DRAW_S / (DRAW_S + FADE_S), 1] } }}
      />
    </svg>
  );
}

/** A 3px rounded line from a source vessel's lip to a target vessel's meniscus, for a poured transfer. */
export function PourStream() {
  const pours = useEffectsStore((s) => s.pours).filter((p) => p.kind === "stream");
  const objects = useLabStore((s) => selectPublic(s).objects);

  return (
    <>
      {pours.map((pour) => {
        const source = objects.find((o) => o.id === pour.sourceId);
        const target = objects.find((o) => o.id === pour.targetId);
        if (!source || source.kind !== "container" || !target || target.kind !== "container") return null;
        return <StreamLine key={pour.id} from={lipPoint(source.position)} to={meniscusPoint(target.position, target.volumeMl, target.capacityMl)} />;
      })}
    </>
  );
}
