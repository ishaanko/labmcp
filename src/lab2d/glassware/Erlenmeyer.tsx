"use client";

import { useId } from "react";
import { Bubbles, GLASS_FILL, LiquidBody, OUTLINE, OUTLINE_SELECTED, OUTLINE_WIDTH, OUTLINE_WIDTH_SELECTED, PrecipitateBed, SelectionRing, StirSwirl, VesselFrame } from "./common";
import { VESSEL_GEOMETRY, clampAlpha, liquidRect } from "./liquid";
import type { VesselProps } from "./types";

const VIEW_W = 120;
const VIEW_H = 160;
const GEO = VESSEL_GEOMETRY.flask;

/** A conical (Erlenmeyer) flask: wide base, narrow neck. Maps from `ContainerType` "flask". */
export function Erlenmeyer(props: VesselProps) {
  const clipId = useId();
  const rect = liquidRect("flask", props.volumeMl, props.capacityMl);
  const outline = props.selected ? OUTLINE_SELECTED : OUTLINE;
  const outlineWidth = props.selected ? OUTLINE_WIDTH_SELECTED : OUTLINE_WIDTH;

  return (
    <VesselFrame viewBoxWidth={VIEW_W} viewBoxHeight={VIEW_H} size={props.size ?? 120} label={props.label} hovered={props.hovered}>
      <defs>
        <clipPath id={clipId}>
          <polygon points={GEO.clipPoints} />
        </clipPath>
      </defs>
      <SelectionRing x={22} y={30} width={76} height={116} agentActive={props.agentActive} />
      <path
        d="M52,30 L52,50 L22,140 Q22,146 28,146 L92,146 Q98,146 98,140 L68,50 L68,30 Z"
        fill={GLASS_FILL}
        stroke={outline}
        strokeWidth={outlineWidth}
        strokeLinejoin="round"
        style={{ transition: "stroke 200ms, stroke-width 200ms" }}
      />
      <LiquidBody rect={rect} color={clampAlpha(props.color, 0.55)} clipId={clipId} />
      {props.precipitate && <PrecipitateBed precipitate={props.precipitate} left={26} right={94} floorY={144} />}
      <Bubbles intensity={props.bubbleIntensity} left={30} right={90} floorY={142} ceilingY={54} />
      {props.stirring && rect.height > 8 && <StirSwirl x={60} y={rect.y + 6} />}
    </VesselFrame>
  );
}
