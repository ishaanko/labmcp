"use client";

import { useId } from "react";
import { GLASS_FILL, OUTLINE, VesselFrame } from "./common";
import type { InstrumentProps } from "./types";

const VIEW_W = 120;
const VIEW_H = 160;
const TUBE_TOP = 20;
const TUBE_BOTTOM = 118;
const FILL_COLOR = "rgba(255,107,107,0.9)";

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Reads the leading number out of a formatted string like "23.4 C". Assumes a 0-100 C column range. */
function columnFraction(reading: string | null): number {
  if (reading === null) return 0;
  const match = /-?\d+(\.\d+)?/.exec(reading);
  if (!match) return 0;
  return clamp01(Number.parseFloat(match[0]) / 100);
}

export function Thermometer(props: InstrumentProps) {
  const clipId = useId();
  const frac = columnFraction(props.reading);
  const fillHeight = frac * (TUBE_BOTTOM - TUBE_TOP);
  const fillY = TUBE_BOTTOM - fillHeight;

  return (
    <VesselFrame viewBoxWidth={VIEW_W} viewBoxHeight={VIEW_H} size={props.size ?? 120} label="Thermometer" hovered={false}>
      <defs>
        <clipPath id={clipId}>
          <rect x={52} y={TUBE_TOP} width={16} height={TUBE_BOTTOM - TUBE_TOP} rx={8} />
        </clipPath>
      </defs>
      <rect x={52} y={TUBE_TOP} width={16} height={TUBE_BOTTOM - TUBE_TOP} rx={8} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={2.5} />
      <g clipPath={`url(#${clipId})`}>
        <rect
          x={52}
          y={fillY}
          width={16}
          height={fillHeight + 20}
          fill={FILL_COLOR}
          style={{ transition: "y 360ms cubic-bezier(0.23,1,0.32,1), height 360ms cubic-bezier(0.23,1,0.32,1)" }}
        />
      </g>
      <circle cx={60} cy={130} r={11} fill={FILL_COLOR} stroke={OUTLINE} strokeWidth={2.5} />
      <text x={60} y={150} fontSize={11} textAnchor="middle" fill="var(--ink-2)" className="tabular-nums">
        {props.reading ?? "--"}
      </text>
    </VesselFrame>
  );
}
