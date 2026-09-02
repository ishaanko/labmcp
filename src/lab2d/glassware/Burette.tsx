"use client";

import { useId } from "react";
import { GLASS_FILL, GlassHighlight, LiquidBody, OUTLINE, OUTLINE_SELECTED, OUTLINE_WIDTH, OUTLINE_WIDTH_SELECTED, SelectionRing, VesselFrame } from "./common";
import { BURETTE_GEOMETRY, buretteFill, vibrant } from "./liquid";
import type { VesselProps } from "./types";

const VIEW_W = 44;
const VIEW_H = 240;
const GEO = BURETTE_GEOMETRY;
const TICK_YS = [36, 64, 92, 120, 148, 176, 200];
const TUBE_CX = (GEO.left + GEO.right) / 2;

/** Tall burette with a stopcock and a tip at the bottom center, so a drop can fall from it. */
export function Burette(props: VesselProps) {
  const clipId = useId();
  const rect = buretteFill(props.volumeMl, props.capacityMl);
  const outline = props.selected ? OUTLINE_SELECTED : OUTLINE;
  const outlineWidth = props.selected ? OUTLINE_WIDTH_SELECTED : OUTLINE_WIDTH;

  return (
    <VesselFrame viewBoxWidth={VIEW_W} viewBoxHeight={VIEW_H} size={props.size ?? VIEW_W} label={props.label} hovered={props.hovered} selected={props.selected}>
      <defs>
        <clipPath id={clipId}>
          <polygon points={GEO.clipPoints} />
        </clipPath>
      </defs>
      <SelectionRing x={GEO.left - 5} y={10} width={GEO.right - GEO.left + 10} height={224} selected={props.selected} agentActive={props.agentActive} />
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
        <line key={y} x1={GEO.left} y1={y} x2={GEO.left + 6} y2={y} stroke="rgba(244,244,248,0.5)" strokeWidth={1.5} strokeLinecap="round" />
      ))}
      <GlassHighlight geo={GEO} clipId={clipId} />
      <LiquidBody rect={rect} color={vibrant(props.color)} clipId={clipId} />
      {/* Stopcock */}
      <rect x={TUBE_CX - 6} y={GEO.bottomY - 2} width={12} height={9} rx={2} fill={GLASS_FILL} stroke={outline} strokeWidth={outlineWidth} />
      <line x1={TUBE_CX - 12} y1={GEO.bottomY + 3} x2={TUBE_CX + 12} y2={GEO.bottomY + 3} stroke={outline} strokeWidth={outlineWidth} strokeLinecap="round" />
      {/* Tip: a drop falls from here, centered on the tube. */}
      <path
        d={`M${TUBE_CX - 4},224 L${TUBE_CX + 4},224 L${TUBE_CX},234 Z`}
        fill={GLASS_FILL}
        stroke={outline}
        strokeWidth={outlineWidth}
        strokeLinejoin="round"
      />
    </VesselFrame>
  );
}
