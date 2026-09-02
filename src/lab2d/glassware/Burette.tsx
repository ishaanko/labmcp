"use client";

import { useId } from "react";
import { GLASS_FILL, LiquidBody, OUTLINE, OUTLINE_SELECTED, OUTLINE_WIDTH, OUTLINE_WIDTH_SELECTED, SelectionRing, VesselFrame } from "./common";
import { BURETTE_GEOMETRY, buretteFill, clampAlpha } from "./liquid";
import type { VesselProps } from "./types";

const VIEW_W = 120;
const VIEW_H = 260;
const GEO = BURETTE_GEOMETRY;
const TICK_YS = [40, 70, 100, 130, 160, 190, 216];

/** Tall burette with a stopcock and a tip at the bottom center, so a drop can fall from it. */
export function Burette(props: VesselProps) {
  const clipId = useId();
  const rect = buretteFill(props.volumeMl, props.capacityMl);
  const outline = props.selected ? OUTLINE_SELECTED : OUTLINE;
  const outlineWidth = props.selected ? OUTLINE_WIDTH_SELECTED : OUTLINE_WIDTH;

  return (
    <VesselFrame viewBoxWidth={VIEW_W} viewBoxHeight={VIEW_H} size={props.size ?? 120} label={props.label} hovered={props.hovered}>
      <defs>
        <clipPath id={clipId}>
          <polygon points={GEO.clipPoints} />
        </clipPath>
      </defs>
      <SelectionRing x={GEO.left - 4} y={12} width={GEO.right - GEO.left + 8} height={238} agentActive={props.agentActive} />
      {/* Tube */}
      <rect
        x={GEO.left}
        y={GEO.topY}
        width={GEO.right - GEO.left}
        height={GEO.bottomY - GEO.topY}
        fill={GLASS_FILL}
        stroke={outline}
        strokeWidth={outlineWidth}
        style={{ transition: "stroke 200ms, stroke-width 200ms" }}
      />
      {TICK_YS.map((y) => (
        <line key={y} x1={GEO.left} y1={y} x2={GEO.left + 5} y2={y} stroke="rgba(230,230,238,0.4)" strokeWidth={1} />
      ))}
      <LiquidBody rect={rect} color={clampAlpha(props.color, 0.55)} clipId={clipId} />
      {/* Stopcock */}
      <rect x={54} y={GEO.bottomY - 2} width={12} height={10} rx={2} fill={GLASS_FILL} stroke={outline} strokeWidth={outlineWidth} />
      <line x1={40} y1={GEO.bottomY + 3} x2={80} y2={GEO.bottomY + 3} stroke={outline} strokeWidth={outlineWidth} strokeLinecap="round" />
      {/* Tip: a drop falls from here, centered at x=60. */}
      <path d="M56,242 L64,242 L60,254 Z" fill={GLASS_FILL} stroke={outline} strokeWidth={outlineWidth} strokeLinejoin="round" />
    </VesselFrame>
  );
}
