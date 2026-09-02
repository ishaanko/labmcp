"use client";

import { useId } from "react";
import { Bubbles, GLASS_FILL, GlassHighlight, LiquidBody, OUTLINE, OUTLINE_SELECTED, OUTLINE_WIDTH, OUTLINE_WIDTH_SELECTED, PrecipitateBed, SelectionRing, StirSwirl, VesselFrame } from "./common";
import { VESSEL_GEOMETRY, liquidRect, vibrant } from "./liquid";
import type { VesselProps } from "./types";

const VIEW_W = 108;
const VIEW_H = 130;
const GEO = VESSEL_GEOMETRY.beaker;

export function Beaker(props: VesselProps) {
  const clipId = useId();
  const rect = liquidRect("beaker", props.volumeMl, props.capacityMl);
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
        rx={10}
        fill={GLASS_FILL}
        stroke={outline}
        strokeWidth={outlineWidth}
        strokeLinejoin="round"
        style={{ transition: "stroke 200ms, stroke-width 200ms" }}
      />
      {/* Pour spout: a small lip at the top-right rim. */}
      <path
        d="M92,22 L104,10 L104,26 Z"
        fill={GLASS_FILL}
        stroke={outline}
        strokeWidth={outlineWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ transition: "stroke 200ms" }}
      />
      <GlassHighlight geo={GEO} clipId={clipId} />
      <LiquidBody rect={rect} color={vibrant(props.color)} clipId={clipId} />
      {props.precipitate && <PrecipitateBed precipitate={props.precipitate} left={GEO.left + 3} right={GEO.right - 3} floorY={GEO.bottomY - 2} />}
      <Bubbles intensity={props.bubbleIntensity} left={GEO.left + 6} right={GEO.right - 6} floorY={GEO.bottomY - 4} ceilingY={GEO.topY + 6} />
      {props.stirring && rect.height > 8 && <StirSwirl x={54} y={rect.y + 8} />}
    </VesselFrame>
  );
}
