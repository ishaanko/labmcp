"use client";

import { useId } from "react";
import { Bubbles, GLASS_FILL, LiquidBody, OUTLINE, OUTLINE_SELECTED, OUTLINE_WIDTH, OUTLINE_WIDTH_SELECTED, PrecipitateBed, SelectionRing, StirSwirl, VesselFrame } from "./common";
import { VESSEL_GEOMETRY, clampAlpha, liquidRect } from "./liquid";
import type { VesselProps } from "./types";

const VIEW_W = 120;
const VIEW_H = 160;
const GEO = VESSEL_GEOMETRY.test_tube;

export function TestTube(props: VesselProps) {
  const clipId = useId();
  const rect = liquidRect("test_tube", props.volumeMl, props.capacityMl);
  const outline = props.selected ? OUTLINE_SELECTED : OUTLINE;
  const outlineWidth = props.selected ? OUTLINE_WIDTH_SELECTED : OUTLINE_WIDTH;

  return (
    <VesselFrame viewBoxWidth={VIEW_W} viewBoxHeight={VIEW_H} size={props.size ?? 120} label={props.label} hovered={props.hovered} selected={props.selected}>
      <defs>
        <clipPath id={clipId}>
          <polygon points={GEO.clipPoints} />
        </clipPath>
      </defs>
      <SelectionRing x={44} y={30} width={32} height={114} selected={props.selected} agentActive={props.agentActive} />
      <path
        d="M44,28 L44,128 A16,16 0 0 0 76,128 L76,28"
        fill={GLASS_FILL}
        stroke={outline}
        strokeWidth={outlineWidth}
        style={{ transition: "stroke 200ms, stroke-width 200ms" }}
      />
      <LiquidBody rect={rect} color={clampAlpha(props.color, 0.45)} clipId={clipId} />
      {props.precipitate && <PrecipitateBed precipitate={props.precipitate} left={GEO.left + 2} right={GEO.right - 2} floorY={GEO.bottomY} />}
      <Bubbles intensity={props.bubbleIntensity} left={GEO.left + 3} right={GEO.right - 3} floorY={GEO.bottomY - 4} ceilingY={GEO.topY + 4} />
      {props.stirring && rect.height > 8 && <StirSwirl x={60} y={rect.y + 5} />}
    </VesselFrame>
  );
}
