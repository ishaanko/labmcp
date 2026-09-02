"use client";

import { useId } from "react";
import { Bubbles, GLASS_FILL, LiquidBody, OUTLINE, OUTLINE_SELECTED, OUTLINE_WIDTH, OUTLINE_WIDTH_SELECTED, PrecipitateBed, SelectionRing, StirSwirl, VesselFrame } from "./common";
import { VESSEL_GEOMETRY, clampAlpha, liquidRect } from "./liquid";
import type { VesselProps } from "./types";

const VIEW_W = 120;
const VIEW_H = 160;
const GEO = VESSEL_GEOMETRY.beaker;

export function Beaker(props: VesselProps) {
  const clipId = useId();
  const rect = liquidRect("beaker", props.volumeMl, props.capacityMl);
  const outline = props.selected ? OUTLINE_SELECTED : OUTLINE;
  const outlineWidth = props.selected ? OUTLINE_WIDTH_SELECTED : OUTLINE_WIDTH;

  return (
    <VesselFrame viewBoxWidth={VIEW_W} viewBoxHeight={VIEW_H} size={props.size ?? 120} label={props.label} hovered={props.hovered}>
      <defs>
        <clipPath id={clipId}>
          <polygon points={GEO.clipPoints} />
        </clipPath>
      </defs>
      <SelectionRing x={20} y={36} width={80} height={108} agentActive={props.agentActive} />
      <rect
        x={20}
        y={36}
        width={80}
        height={108}
        rx={8}
        fill={GLASS_FILL}
        stroke={outline}
        strokeWidth={outlineWidth}
        style={{ transition: "stroke 200ms, stroke-width 200ms" }}
      />
      <path
        d="M92,38 L102,28 L102,42 Z"
        fill={GLASS_FILL}
        stroke={outline}
        strokeWidth={outlineWidth}
        strokeLinejoin="round"
        style={{ transition: "stroke 200ms" }}
      />
      <LiquidBody rect={rect} color={clampAlpha(props.color, 0.55)} clipId={clipId} />
      {props.precipitate && <PrecipitateBed precipitate={props.precipitate} left={GEO.left + 2} right={GEO.right - 2} floorY={GEO.bottomY} />}
      <Bubbles intensity={props.bubbleIntensity} left={GEO.left + 4} right={GEO.right - 4} floorY={GEO.bottomY - 2} ceilingY={GEO.topY + 6} />
      {props.stirring && rect.height > 8 && <StirSwirl x={60} y={rect.y + 6} />}
    </VesselFrame>
  );
}
