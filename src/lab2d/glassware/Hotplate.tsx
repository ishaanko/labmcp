"use client";

import { useId } from "react";
import { GLASS_FILL, OUTLINE, VesselFrame } from "./common";
import type { InstrumentProps } from "./types";

const VIEW_W = 120;
/** Taller than the slab itself so the plate sits low in its cell: a container sharing the cell stands on it. */
const VIEW_H = 188;
const PLATE_TOP = 124;
const PLATE_CENTER_Y = PLATE_TOP + 8;
const CORAL = "#ff6b6b";

/**
 * Hotplate: a rounded slab with a dark burner ring and a dial, and a static warm coral glow over
 * the coil, scaled by `heatLevel`. Drawn low in its cell, under where a vessel's base lands, so a
 * container that shares the cell reads as standing on the plate.
 */
export function Hotplate(props: InstrumentProps) {
  const glowId = useId();
  const knobAngle = (props.heatLevel * 220 - 110) * (Math.PI / 180);

  return (
    <VesselFrame viewBoxWidth={VIEW_W} viewBoxHeight={VIEW_H} size={props.size ?? VIEW_W} label="Hotplate" hovered={false}>
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={CORAL} stopOpacity={0.85} />
          <stop offset="100%" stopColor={CORAL} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={0} y={PLATE_TOP} width={120} height={56} rx={16} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={3} />
      <ellipse cx={56} cy={PLATE_CENTER_Y} rx={44} ry={17} fill="#0e1015" stroke={OUTLINE} strokeWidth={2.5} />
      <ellipse cx={56} cy={PLATE_CENTER_Y} rx={30} ry={11} fill="none" stroke={OUTLINE} strokeWidth={1.5} opacity={0.6} />
      <ellipse cx={56} cy={PLATE_CENTER_Y} rx={16} ry={6} fill="none" stroke={OUTLINE} strokeWidth={1.5} opacity={0.6} />
      {/* Warm glow sits on top of the burner ring, semi-transparent, so it tints the coil instead of hiding under it. */}
      <ellipse
        cx={56}
        cy={PLATE_CENTER_Y}
        rx={44}
        ry={17}
        fill={`url(#${glowId})`}
        style={{ opacity: props.heatLevel, transition: "opacity 300ms" }}
      />
      <circle cx={102} cy={PLATE_TOP + 34} r={11} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={2.5} />
      <line
        x1={102}
        y1={PLATE_TOP + 34}
        x2={102 + 6 * Math.cos(knobAngle)}
        y2={PLATE_TOP + 34 + 6 * Math.sin(knobAngle)}
        stroke={OUTLINE}
        strokeWidth={2}
        strokeLinecap="round"
        style={{ transition: "x2 300ms, y2 300ms" }}
      />
    </VesselFrame>
  );
}
