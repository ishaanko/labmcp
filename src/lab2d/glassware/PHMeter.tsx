"use client";

import { GLASS_FILL, OUTLINE, VesselFrame } from "./common";
import type { InstrumentProps } from "./types";

const VIEW_W = 120;
const VIEW_H = 160;

/**
 * pH probe: a meter box with the reading, plus a rod dipping down to the electrode tip. Docked
 * (attached) it drops its caption; the selection card names it, and the caption would cross the
 * host vessel's neck.
 */
export function PHMeter(props: InstrumentProps) {
  const rodOpacity = props.attached ? 1 : 0.45;

  return (
    <VesselFrame viewBoxWidth={VIEW_W} viewBoxHeight={VIEW_H} size={props.size ?? 120} label={props.attached ? "" : "pH meter"} hovered={false}>
      <rect x={20} y={10} width={80} height={36} rx={8} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={2.5} />
      <text x={60} y={35} fontSize={18} fontWeight={600} textAnchor="middle" fill="#e6e6ee" className="tabular-nums">
        {props.reading ?? "--"}
      </text>
      <g style={{ opacity: rodOpacity, transition: "opacity 200ms" }}>
        <line x1={60} y1={46} x2={60} y2={132} stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
        <circle cx={60} cy={140} r={6} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={2.5} />
      </g>
    </VesselFrame>
  );
}
