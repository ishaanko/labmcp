"use client";

import { useId } from "react";
import { Bubbles, GLASS_FILL, GlassHighlight, LiquidBody, OUTLINE, OUTLINE_SELECTED, OUTLINE_WIDTH, OUTLINE_WIDTH_SELECTED, PrecipitateBed, SelectionRing, StirSwirl, VesselFrame } from "./common";
import { VESSEL_GEOMETRY, liquidRect, vibrant } from "./liquid";
import type { VesselProps } from "./types";

const VIEW_W = 108;
const VIEW_H = 130;
const GEO = VESSEL_GEOMETRY.flask;

/** A conical (Erlenmeyer) flask: wide base, narrow neck. Maps from `ContainerType` "flask". */
export function Erlenmeyer(props: VesselProps) {
  const clipId = useId();
  const rect = liquidRect("flask", props.volumeMl, props.capacityMl);
  const outline = props.selected ? OUTLINE_SELECTED : OUTLINE;
  const outlineWidth = props.selected ? OUTLINE_WIDTH_SELECTED : OUTLINE_WIDTH;

  return (
    <VesselFrame viewBoxWidth={VIEW_W} viewBoxHeight={VIEW_H} size={props.size ?? VIEW_W} label={props.label} hovered={props.hovered} selected={props.selected}>
      <defs>
        <clipPath id={clipId}>
          <polygon points={GEO.clipPoints} />
        </clipPath>
      </defs>
      <SelectionRing x={16} y={GEO.topY} width={76} height={GEO.bottomY - GEO.topY} selected={props.selected} agentActive={props.agentActive} />
      <path
        d="M44,22 L44,42 L16,112 Q16,118 22,118 L86,118 Q92,118 92,112 L64,42 L64,22 Z"
        fill={GLASS_FILL}
        stroke={outline}
        strokeWidth={outlineWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ transition: "stroke 200ms, stroke-width 200ms" }}
      />
      <GlassHighlight geo={GEO} clipId={clipId} />
      <LiquidBody rect={rect} color={vibrant(props.color)} clipId={clipId} />
      {props.precipitate && <PrecipitateBed precipitate={props.precipitate} left={GEO.left + 3} right={GEO.right - 3} floorY={GEO.bottomY - 2} />}
      <Bubbles intensity={props.bubbleIntensity} left={GEO.left + 6} right={GEO.right - 6} floorY={GEO.bottomY - 4} ceilingY={GEO.topY + 4} />
      {props.stirring && rect.height > 8 && <StirSwirl x={54} y={rect.y + 8} />}
    </VesselFrame>
  );
}
