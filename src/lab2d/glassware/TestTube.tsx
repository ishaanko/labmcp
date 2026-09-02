"use client";

import { useId } from "react";
import { Bubbles, GLASS_FILL, GlassHighlight, LiquidBody, OUTLINE, OUTLINE_SELECTED, OUTLINE_WIDTH, OUTLINE_WIDTH_SELECTED, PrecipitateBed, SelectionRing, StirSwirl, VesselFrame } from "./common";
import { VESSEL_GEOMETRY, liquidRect, vibrant } from "./liquid";
import type { VesselProps } from "./types";

const VIEW_W = 40;
const VIEW_H = 120;
const GEO = VESSEL_GEOMETRY.test_tube;

export function TestTube(props: VesselProps) {
  const clipId = useId();
  const rect = liquidRect("test_tube", props.volumeMl, props.capacityMl);
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
      <path
        d="M6,14 L6,96 A14,14 0 0 0 34,96 L34,14"
        fill={GLASS_FILL}
        stroke={outline}
        strokeWidth={outlineWidth}
        strokeLinecap="round"
        style={{ transition: "stroke 200ms, stroke-width 200ms" }}
      />
      <GlassHighlight geo={GEO} clipId={clipId} />
      <LiquidBody rect={rect} color={vibrant(props.color)} clipId={clipId} />
      {props.precipitate && <PrecipitateBed precipitate={props.precipitate} left={GEO.left + 2} right={GEO.right - 2} floorY={GEO.bottomY - 4} />}
      <Bubbles intensity={props.bubbleIntensity} left={GEO.left + 2} right={GEO.right - 2} floorY={GEO.bottomY - 6} ceilingY={GEO.topY + 4} />
      {props.stirring && rect.height > 8 && <StirSwirl x={20} y={rect.y + 6} />}
    </VesselFrame>
  );
}
