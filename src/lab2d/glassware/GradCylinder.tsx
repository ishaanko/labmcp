"use client";

import { useId } from "react";
import { Bubbles, GLASS_FILL, GlassHighlight, LiquidBody, OUTLINE, OUTLINE_SELECTED, OUTLINE_WIDTH, OUTLINE_WIDTH_SELECTED, PrecipitateBed, SelectionRing, StirSwirl, VesselFrame } from "./common";
import { VESSEL_GEOMETRY, liquidRect, vibrant } from "./liquid";
import type { VesselProps } from "./types";

const VIEW_W = 56;
const VIEW_H = 150;
const GEO = VESSEL_GEOMETRY.graduated_cylinder;
const TICK_YS = [38, 62, 86, 110, 134];

export function GradCylinder(props: VesselProps) {
  const clipId = useId();
  const rect = liquidRect("graduated_cylinder", props.volumeMl, props.capacityMl);
  const outline = props.selected ? OUTLINE_SELECTED : OUTLINE;
  const outlineWidth = props.selected ? OUTLINE_WIDTH_SELECTED : OUTLINE_WIDTH;

  return (
    <VesselFrame viewBoxWidth={VIEW_W} viewBoxHeight={VIEW_H} size={props.size ?? VIEW_W} label={props.label} hovered={props.hovered} selected={props.selected}>
      <defs>
        <clipPath id={clipId}>
          <polygon points={GEO.clipPoints} />
        </clipPath>
      </defs>
      <SelectionRing x={GEO.left} y={GEO.topY} width={GEO.right - GEO.left} height={GEO.bottomY - GEO.topY} selected={props.selected} agentActive={props.agentActive} />
      <rect
        x={GEO.left}
        y={GEO.topY}
        width={GEO.right - GEO.left}
        height={GEO.bottomY - GEO.topY}
        rx={5}
        fill={GLASS_FILL}
        stroke={outline}
        strokeWidth={outlineWidth}
        style={{ transition: "stroke 200ms, stroke-width 200ms" }}
      />
      <path
        d="M40,22 L52,10 L52,24 Z"
        fill={GLASS_FILL}
        stroke={outline}
        strokeWidth={outlineWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ transition: "stroke 200ms" }}
      />
      {TICK_YS.map((y) => (
        <line key={y} x1={GEO.left} y1={y} x2={GEO.left + 7} y2={y} stroke="rgba(244,244,248,0.5)" strokeWidth={1.5} strokeLinecap="round" />
      ))}
      <GlassHighlight geo={GEO} clipId={clipId} />
      <LiquidBody rect={rect} color={vibrant(props.color)} clipId={clipId} />
      {props.precipitate && <PrecipitateBed precipitate={props.precipitate} left={GEO.left + 2} right={GEO.right - 2} floorY={GEO.bottomY - 2} />}
      <Bubbles intensity={props.bubbleIntensity} left={GEO.left + 4} right={GEO.right - 4} floorY={GEO.bottomY - 4} ceilingY={GEO.topY + 6} />
      {props.stirring && rect.height > 8 && <StirSwirl x={28} y={rect.y + 8} />}
    </VesselFrame>
  );
}
