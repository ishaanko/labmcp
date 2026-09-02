"use client";

import { GLASS_FILL, OUTLINE, VesselFrame } from "./common";
import type { InstrumentProps } from "./types";

const VIEW_W = 64;
const VIEW_H = 150;
const LCD_BG = "#0c1a12";
const LCD_TEXT = "#7ae582";

/**
 * pH probe: a handheld meter body with a mint LCD readout, plus a cable dropping to an electrode
 * bulb. Docked (attached) it drops its caption; the selection card names it, and the caption
 * would cross the host vessel's neck.
 */
export function PHMeter(props: InstrumentProps) {
  const rodOpacity = props.attached ? 1 : 0.45;
  const size = props.size ?? VIEW_W;

  return (
    <VesselFrame viewBoxWidth={VIEW_W} viewBoxHeight={VIEW_H} size={size} label={props.attached ? "" : "pH meter"} hovered={false}>
      <rect x={2} y={2} width={60} height={84} rx={16} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <rect x={10} y={14} width={44} height={30} rx={7} fill={LCD_BG} stroke={OUTLINE} strokeWidth={1.5} />
      <text x={32} y={34} fontSize={16} fontWeight={600} textAnchor="middle" fill={LCD_TEXT} className="tabular-nums">
        {props.reading ?? "pH --"}
      </text>
      <circle cx={17} cy={58} r={3.5} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={1.5} />
      <circle cx={32} cy={58} r={3.5} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={1.5} />
      <circle cx={47} cy={58} r={3.5} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={1.5} />
      <g style={{ opacity: rodOpacity, transition: "opacity 200ms" }}>
        <path d="M32,86 C 18,102 46,118 32,134" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" fill="none" />
        <circle cx={32} cy={142} r={7} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={3} />
      </g>
    </VesselFrame>
  );
}
