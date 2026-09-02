"use client";

import { motion } from "motion/react";
import { useLabStore } from "@/store/labStore";
import { selectPublic } from "@/store/selectors";
import { CELL_H, cellToPx, type XY } from "../grid";
import { useEffectsStore } from "../effectsStore";

const STROKE = "rgba(230, 230, 238, 0.9)";
const FALL_S = 0.16;
const RIPPLE_S = 0.16;

/** Where a burette's tip hangs: 35px into the flask's cell below, at the neck mouth (the caption above the tube pushes the tube down that far). */
function tipPoint(position: { x: number; y: number }): XY {
  const c = cellToPx(position);
  return { x: c.x, y: c.y + CELL_H / 2 + 35 };
}

function meniscusPoint(position: { x: number; y: number }, volumeMl: number, capacityMl: number): XY {
  const c = cellToPx(position);
  const fill = capacityMl > 0 ? Math.min(1, volumeMl / capacityMl) : 0;
  return { x: c.x, y: c.y + CELL_H / 2 - 24 - fill * (CELL_H - 60) };
}

function FallingDrop({ from, to }: { from: XY; to: XY }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      <motion.circle
        r={4}
        fill={STROKE}
        initial={{ cx: from.x, cy: from.y, opacity: 1 }}
        animate={{ cx: to.x, cy: to.y, opacity: [1, 1, 0] }}
        transition={{ duration: FALL_S, ease: "easeIn" }}
      />
      <motion.circle
        cx={to.x}
        cy={to.y}
        r={0}
        stroke={STROKE}
        strokeWidth={3}
        fill="none"
        initial={{ r: 0, opacity: 0.9 }}
        animate={{ r: 14, opacity: 0 }}
        transition={{ delay: FALL_S, duration: RIPPLE_S, ease: "easeOut" }}
      />
    </svg>
  );
}

/** A burette dispense: a drop falls from the tip to the target's meniscus, then a ripple ring. */
export function Drop() {
  const pours = useEffectsStore((s) => s.pours).filter((p) => p.kind === "drop");
  const objects = useLabStore((s) => selectPublic(s).objects);

  return (
    <>
      {pours.map((pour) => {
        const source = objects.find((o) => o.id === pour.sourceId);
        const target = objects.find((o) => o.id === pour.targetId);
        if (!source || source.kind !== "container" || !target || target.kind !== "container") return null;
        return <FallingDrop key={pour.id} from={tipPoint(source.position)} to={meniscusPoint(target.position, target.volumeMl, target.capacityMl)} />;
      })}
    </>
  );
}
