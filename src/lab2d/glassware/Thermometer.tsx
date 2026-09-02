"use client";

import { useId } from "react";
import { OUTLINE, VesselFrame } from "./common";
import type { InstrumentProps } from "./types";

const VIEW_W = 36;
const VIEW_H = 144;
const TUBE_TOP = 6;
const TUBE_BOTTOM = 104;
const TUBE_FILL = "rgba(255,255,255,0.16)";
const RED = "#ff6b6b";

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Reads the leading number out of a formatted string like "23.4°C". Assumes a 0-100°C column range. */
function columnFraction(reading: string | null): number {
  if (reading === null) return 0;
  const match = /-?\d+(\.\d+)?/.exec(reading);
  if (!match) return 0;
  return clamp01(Number.parseFloat(match[0]) / 100);
}

/** Red mercury column in a white glass tube, capped by a bulb. */
export function Thermometer(props: InstrumentProps) {
  const clipId = useId();
  const frac = columnFraction(props.reading);
  const fillHeight = frac * (TUBE_BOTTOM - TUBE_TOP);
  const fillY = TUBE_BOTTOM - fillHeight;
  const size = props.size ?? VIEW_W;

  return (
    <VesselFrame viewBoxWidth={VIEW_W} viewBoxHeight={VIEW_H} size={size} label={props.attached ? "" : "Thermometer"} hovered={false}>
      <defs>
        <clipPath id={clipId}>
          <rect x={12} y={TUBE_TOP} width={12} height={TUBE_BOTTOM - TUBE_TOP + 20} rx={6} />
        </clipPath>
      </defs>
      <rect x={12} y={TUBE_TOP} width={12} height={TUBE_BOTTOM - TUBE_TOP} rx={6} fill={TUBE_FILL} stroke={OUTLINE} strokeWidth={3} />
      <g clipPath={`url(#${clipId})`}>
        <rect
          x={12}
          y={fillY}
          width={12}
          height={fillHeight + 20}
          fill={RED}
          style={{ transition: "y 360ms cubic-bezier(0.23,1,0.32,1), height 360ms cubic-bezier(0.23,1,0.32,1)" }}
        />
      </g>
      <circle cx={18} cy={116} r={12} fill={RED} stroke={OUTLINE} strokeWidth={3} />
      <text x={18} y={140} fontSize={12} fontWeight={500} textAnchor="middle" fill="white" fillOpacity={0.85} className="tabular-nums">
        {props.reading ?? "--"}
      </text>
    </VesselFrame>
  );
}
