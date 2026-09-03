"use client";

import { GLASS_FILL, OUTLINE, VesselFrame } from "./common";
import type { InstrumentDockGeometry, InstrumentProps } from "./types";

const VIEW_W = 64;
const VIEW_H = 150;
const LCD_BG = "#0c1a12";
const LCD_TEXT = "#7ae582";

/** Local y where the cord leaves the body: fixed regardless of dock depth, so the body never moves as the liquid level changes. */
const CORD_ANCHOR_Y = 86;
/** Bulb center when standalone (not docked), matching the original fixed art. */
const STANDALONE_BULB_Y = 135;
const BULB_R = 7;

/** Placement data `dockedInstrumentPose` (grid.ts) needs to anchor this component to a container. */
export const PH_METER_DOCK: InstrumentDockGeometry = { viewBoxWidth: VIEW_W, viewBoxHeight: VIEW_H, anchorY: CORD_ANCHOR_Y };

/** A gentle S-curve from the fixed cord anchor down to the bulb center. */
function cordPath(bulbCenterY: number): string {
  const span = bulbCenterY - CORD_ANCHOR_Y;
  const c1y = CORD_ANCHOR_Y + span * (1 / 3);
  const c2y = CORD_ANCHOR_Y + span * (2 / 3);
  return `M32,${CORD_ANCHOR_Y} C 18,${c1y} 46,${c2y} 32,${bulbCenterY}`;
}

/**
 * pH probe: a handheld meter body with a mint LCD readout, plus a cable dropping to an electrode
 * bulb. The LCD shows the number alone with a small "pH" tag above it: "pH 0.98" at 16px is wider
 * than the 44-unit screen. Docked (attached) it drops its caption; the selection card names it,
 * and the caption would cross the host vessel's neck.
 *
 * Docked, the cord and bulb stretch to `dockDepthPx` (converted to local units below) so the bulb
 * reaches the live liquid surface at any fill level; the body itself stays put at the fixed cord
 * anchor. An invisible envelope rect behind everything makes the whole cord + bulb one generous
 * hit area instead of a thin stroke.
 */
export function PHMeter(props: InstrumentProps) {
  const rodOpacity = props.attached ? 1 : 0.45;
  const size = props.size ?? VIEW_W;
  const scale = size / VIEW_W;
  const bulbCenterY = props.dockDepthPx !== undefined ? CORD_ANCHOR_Y + props.dockDepthPx / scale : STANDALONE_BULB_Y;
  const envelopeBottom = Math.max(VIEW_H, bulbCenterY + BULB_R + 12);

  return (
    <VesselFrame viewBoxWidth={VIEW_W} viewBoxHeight={VIEW_H} size={size} label={props.attached ? "" : "pH meter"} hovered={false}>
      <rect x={-10} y={-8} width={VIEW_W + 20} height={envelopeBottom + 8} fill="rgba(0,0,0,0)" />
      <rect x={2} y={2} width={60} height={84} rx={16} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <rect x={10} y={14} width={44} height={30} rx={7} fill={LCD_BG} stroke={OUTLINE} strokeWidth={1.5} />
      <text x={13} y={21} fontSize={7} fontWeight={600} fill={LCD_TEXT} opacity={0.7}>
        pH
      </text>
      <text x={32} y={37} fontSize={16} fontWeight={600} textAnchor="middle" fill={LCD_TEXT} className="tabular-nums">
        {props.reading ? props.reading.replace(/^pH\s*/, "") : "--"}
      </text>
      <circle cx={17} cy={58} r={3.5} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={1.5} />
      <circle cx={32} cy={58} r={3.5} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={1.5} />
      <circle cx={47} cy={58} r={3.5} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={1.5} />
      <g style={{ opacity: rodOpacity, transition: "opacity 200ms" }}>
        <path d={cordPath(bulbCenterY)} stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" fill="none" style={{ transition: "d 360ms ease-out" }} />
        <circle cx={32} cy={bulbCenterY} r={BULB_R} fill={GLASS_FILL} stroke={OUTLINE} strokeWidth={3} style={{ transition: "cy 360ms ease-out" }} />
      </g>
    </VesselFrame>
  );
}
