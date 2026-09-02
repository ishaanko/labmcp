"use client";

import { useId } from "react";
import { GLASS_FILL, OUTLINE, VesselFrame } from "./common";
import type { InstrumentProps } from "./types";

const VIEW_W = 120;
/** Taller than the shared 160 so the plate sits at a vessel's base: a flask on this cell stands on it. */
const VIEW_H = 260;
const PLATE_SHIFT = 121;

/**
 * Hotplate: a round plate on a housing with a dial, and a static warm glow scaled by `heatLevel`.
 * Drawn in the lower part of its cell, under where a vessel's base lands, so a container that
 * shares the cell reads as standing on the plate and its glass never covers the housing.
 */
export function Hotplate(props: InstrumentProps) {
  const glowId = useId();

  return (
    <VesselFrame viewBoxWidth={VIEW_W} viewBoxHeight={VIEW_H} size={props.size ?? 120} label="Hotplate" hovered={false}>
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.55} />
          <stop offset="100%" stopColor="var(--amber)" stopOpacity={0} />
        </radialGradient>
      </defs>
      <g transform={`translate(0 ${PLATE_SHIFT})`}>
      <ellipse cx={60} cy={72} rx={48} ry={20} fill={`url(#${glowId})`} style={{ opacity: props.heatLevel, transition: "opacity 300ms" }} />
      <rect x={18} y={92} width={84} height={44} rx={10} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={2.5} />
      <ellipse cx={60} cy={80} rx={42} ry={16} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={2.5} />
      <ellipse cx={60} cy={80} rx={28} ry={10} fill="none" stroke={OUTLINE} strokeWidth={1.5} opacity={0.6} />
      <ellipse cx={60} cy={80} rx={14} ry={5} fill="none" stroke={OUTLINE} strokeWidth={1.5} opacity={0.6} />
      <circle cx={86} cy={114} r={8} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={2} />
      <line
        x1={86}
        y1={114}
        x2={86 + 5 * Math.cos((props.heatLevel * 220 - 110) * (Math.PI / 180))}
        y2={114 + 5 * Math.sin((props.heatLevel * 220 - 110) * (Math.PI / 180))}
        stroke={OUTLINE}
        strokeWidth={1.5}
        strokeLinecap="round"
        style={{ transition: "x2 300ms, y2 300ms" }}
      />
      </g>
    </VesselFrame>
  );
}
