"use client";

import { useId } from "react";
import { OUTLINE, VesselFrame } from "./common";
import type { InstrumentDockGeometry, InstrumentProps } from "./types";

const VIEW_W = 36;
const VIEW_H = 144;
/** Local y of the tube's top: fixed regardless of dock depth, so it never moves as the liquid level changes. */
const TUBE_TOP = 6;
/** Bulb + tube-bottom position when standalone (not docked), matching the original fixed art. */
const STANDALONE_BULB_Y = 116;
const BULB_R = 12;
const TUBE_FILL = "rgba(255,255,255,0.16)";
const RED = "#ff6b6b";

/** Placement data `dockedInstrumentPose` (grid.ts) needs to anchor this component to a container. */
export const THERMOMETER_DOCK: InstrumentDockGeometry = { viewBoxWidth: VIEW_W, viewBoxHeight: VIEW_H, anchorY: TUBE_TOP };

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Reads the leading number out of a formatted string like "23.4°C". Assumes a 0-100°C column range. */
function columnFraction(reading: string | null): number {
  if (reading === null) return 0;
  const match = /-?\d+(\.\d+)?/.exec(reading);
  if (!match) return 0;
  return clamp01(Number.parseFloat(match[0]) / 100);
}

/**
 * Red mercury column in a white glass tube, capped by a bulb. Docked, the tube stretches to
 * `dockDepthPx` (converted to local units below) so the bulb reaches the live liquid surface at
 * any fill level; the tube top stays put at the fixed dock anchor. An invisible envelope rect
 * behind everything makes the whole tube + bulb one generous hit area.
 */
export function Thermometer(props: InstrumentProps) {
  const clipId = useId();
  const size = props.size ?? VIEW_W;
  const scale = size / VIEW_W;
  const bulbY = props.dockDepthPx !== undefined ? TUBE_TOP + props.dockDepthPx / scale : STANDALONE_BULB_Y;
  const tubeBottom = Math.max(TUBE_TOP + 20, bulbY - BULB_R + 4);
  const frac = columnFraction(props.reading);
  const fillHeight = frac * (tubeBottom - TUBE_TOP);
  const fillY = tubeBottom - fillHeight;
  const textY = bulbY + 24;
  const envelopeBottom = Math.max(VIEW_H, textY + 8);

  return (
    <VesselFrame viewBoxWidth={VIEW_W} viewBoxHeight={VIEW_H} size={size} label={props.attached ? "" : "Thermometer"} hovered={false}>
      <defs>
        <clipPath id={clipId}>
          <rect x={12} y={TUBE_TOP} width={12} height={tubeBottom - TUBE_TOP + 20} rx={6} />
        </clipPath>
      </defs>
      <rect x={-10} y={-8} width={VIEW_W + 20} height={envelopeBottom + 8} fill="rgba(0,0,0,0)" />
      <rect
        x={12}
        y={TUBE_TOP}
        width={12}
        height={tubeBottom - TUBE_TOP}
        rx={6}
        fill={TUBE_FILL}
        stroke={OUTLINE}
        strokeWidth={3}
        style={{ transition: "height 360ms ease-out" }}
      />
      <g clipPath={`url(#${clipId})`}>
        <rect
          x={12}
          y={fillY}
          width={12}
          height={fillHeight + 20}
          fill={RED}
          style={{ transition: "y 360ms cubic-bezier(0.23,1,0.32,1), height 360ms cubic-bezier(0.23,1,0.32,1)" }}
        />
      </g>
      <circle cx={18} cy={bulbY} r={BULB_R} fill={RED} stroke={OUTLINE} strokeWidth={3} style={{ transition: "cy 360ms ease-out" }} />
      <text x={18} y={textY} fontSize={12} fontWeight={500} textAnchor="middle" fill="white" fillOpacity={0.85} className="tabular-nums" style={{ transition: "y 360ms ease-out" }}>
        {props.reading ?? "--"}
      </text>
    </VesselFrame>
  );
}
