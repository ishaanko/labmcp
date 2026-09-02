"use client";

import { useId } from "react";
import { Bubbles, GLASS_FILL, LiquidBody, OUTLINE, OUTLINE_SELECTED, OUTLINE_WIDTH, OUTLINE_WIDTH_SELECTED, PrecipitateBed, SelectionRing, StirSwirl, VesselFrame } from "./common";
import { VESSEL_GEOMETRY, clampAlpha, liquidRect } from "./liquid";
import type { VesselProps } from "./types";

const VIEW_W = 120;
const VIEW_H = 160;
const GEO = VESSEL_GEOMETRY.graduated_cylinder;
const TICK_YS = [36, 58, 80, 102, 124];

export function GradCylinder(props: VesselProps) {
  const clipId = useId();
  const rect = liquidRect("graduated_cylinder", props.volumeMl, props.capacityMl);
  const outline = props.selected ? OUTLINE_SELECTED : OUTLINE;
  const outlineWidth = props.selected ? OUTLINE_WIDTH_SELECTED : OUTLINE_WIDTH;

  return (
    <VesselFrame viewBoxWidth={VIEW_W} viewBoxHeight={VIEW_H} size={props.size ?? 120} label={props.label} hovered={props.hovered}>
      <defs>
        <clipPath id={clipId}>
          <polygon points={GEO.clipPoints} />
        </clipPath>
      </defs>
      <SelectionRing x={38} y={16} width={44} height={132} agentActive={props.agentActive} />
      <rect
        x={42}
        y={20}
        width={36}
        height={124}
        rx={4}
        fill={GLASS_FILL}
        stroke={outline}
        strokeWidth={outlineWidth}
        style={{ transition: "stroke 200ms, stroke-width 200ms" }}
      />
      <path
        d="M70,20 L82,10 L82,22 Z"
        fill={GLASS_FILL}
        stroke={outline}
        strokeWidth={outlineWidth}
        strokeLinejoin="round"
        style={{ transition: "stroke 200ms" }}
      />
      {TICK_YS.map((y) => (
        <line key={y} x1={42} y1={y} x2={48} y2={y} stroke="rgba(230,230,238,0.4)" strokeWidth={1} />
      ))}
      <LiquidBody rect={rect} color={clampAlpha(props.color, 0.55)} clipId={clipId} />
      {props.precipitate && <PrecipitateBed precipitate={props.precipitate} left={GEO.left + 2} right={GEO.right - 2} floorY={GEO.bottomY} />}
      <Bubbles intensity={props.bubbleIntensity} left={GEO.left + 4} right={GEO.right - 4} floorY={GEO.bottomY - 3} ceilingY={GEO.topY + 6} />
      {props.stirring && rect.height > 8 && <StirSwirl x={60} y={rect.y + 5} />}
    </VesselFrame>
  );
}
