"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { assertNever, rgbaToCss, type InstrumentReading, type PublicContainer } from "@/engine";
import { Instrument as InstrumentGlass, Vessel } from "@/lab2d/glassware/Glassware";
import type { VesselPrecipitate } from "@/lab2d/glassware/types";
import { fmtC, fmtMl, fmtPh } from "@/lib/format";
import { useLabStore } from "@/store/labStore";
import { selectPublic } from "@/store/selectors";
import { useEffectsStore } from "./effectsStore";
import { cellToPx, dockedInstrumentPx, type XY } from "./grid";
import { useBenchDrag } from "./useBenchDrag";

const VESSEL_SIZE = 104;
const INSTRUMENT_STANDALONE_SIZE = 84;
const INSTRUMENT_DOCKED_SIZE = 52;

/** A liquid's fill floor: engine colors read too faint to see against true black below this alpha. */
const LIQUID_ALPHA_FLOOR = 0.55;

const TILT_DEG = 20;
const PULSE_TRANSITION = { duration: 0.8, ease: "easeInOut" } as const;
const TILT_TRANSITION = { duration: 0.4, ease: "easeInOut" } as const;

function liquidCss(container: PublicContainer): string {
  if (container.volumeMl <= 0) return rgbaToCss(container.color);
  const alpha = Math.max(container.color.a, LIQUID_ALPHA_FLOOR);
  return rgbaToCss({ ...container.color, a: alpha });
}

function precipitateFor(container: PublicContainer): VesselPrecipitate | null {
  const solid = container.solids[0];
  if (!solid) return null;
  return { color: rgbaToCss(solid.color), scale: solid.scale, suspended: solid.suspended };
}

function formatReading(reading: InstrumentReading | null): string | null {
  if (!reading) return null;
  switch (reading.kind) {
    case "ph":
      return fmtPh(reading.value);
    case "temperature":
      return fmtC(reading.valueC);
    case "volume":
      return fmtMl(reading.valueMl);
    default:
      return assertNever(reading);
  }
}

export interface BenchObjectProps {
  readonly id: string;
}

/**
 * One bench object: a container or instrument, positioned on the grid (or docked to its parent
 * container's cell corner when an instrument is attached), draggable, and wired to the effects
 * store for tilt/pulse/agent-glow.
 */
export function BenchObject({ id }: BenchObjectProps) {
  const object = useLabStore((s) => selectPublic(s).objects.find((o) => o.id === id));
  const attachedContainer = useLabStore((s) =>
    object && object.kind === "instrument" && object.attachedTo !== null ? selectPublic(s).objects.find((o) => o.id === object.attachedTo) : undefined,
  );
  const selectedId = useLabStore((s) => s.ui.selectedId);
  const hoveredId = useLabStore((s) => s.ui.hoveredId);
  const tilting = useEffectsStore((s) => s.tiltIds.has(id));
  const pulsing = useEffectsStore((s) => s.pulseIds.has(id));
  const agentActive = useEffectsStore((s) => s.agentActiveIds.has(id));
  const pourTargetId = useEffectsStore((s) => s.pours.find((p) => p.sourceId === id && p.kind === "stream")?.targetId);
  const targetObject = useLabStore((s) => (pourTargetId ? selectPublic(s).objects.find((o) => o.id === pourTargetId) : undefined));

  const docked = object && object.kind === "instrument" && attachedContainer && attachedContainer.kind === "container" ? attachedContainer : undefined;
  const restPx: XY = useMemo(() => {
    if (!object) return { x: 0, y: 0 };
    if (docked) return dockedInstrumentPx(docked.position);
    return cellToPx(object.position);
  }, [object, docked]);

  const isBurette = object !== undefined && object.kind === "container" && object.type === "burette";
  const drag = useBenchDrag(id, object?.kind === "instrument" ? "instrument" : "container", { isBurette, restPx });

  if (!object) return null;

  const pos = drag.livePx ?? restPx;
  const selected = selectedId === id;
  const hovered = hoveredId === id;

  const tiltDeg = tilting && targetObject ? (targetObject.position.x >= object.position.x ? -TILT_DEG : TILT_DEG) : 0;
  const size = object.kind === "container" ? VESSEL_SIZE : docked ? INSTRUMENT_DOCKED_SIZE : INSTRUMENT_STANDALONE_SIZE;

  return (
    <motion.div
      data-object-id={id}
      className="pointer-events-none absolute left-0 top-0 touch-none select-none"
      style={{ zIndex: drag.dragging ? 30 : object.kind === "instrument" ? 20 : 10 }}
      animate={{ x: pos.x, y: pos.y, scale: drag.dragging ? 1.03 : 1 }}
      transition={drag.dragging ? { duration: 0 } : { type: "spring", visualDuration: 0.35, bounce: drag.justReleased ? 0.2 : 0 }}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerCancel}
    >
      <motion.div
        className="-translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
        animate={{ rotate: tiltDeg, scale: pulsing ? [1, 1.04, 1] : 1 }}
        transition={{ rotate: TILT_TRANSITION, scale: PULSE_TRANSITION }}
      >
        {object.kind === "container" ? (
          <Vessel
            type={object.type}
            capacityMl={object.capacityMl}
            volumeMl={object.volumeMl}
            color={liquidCss(object)}
            precipitate={precipitateFor(object)}
            bubbleIntensity={object.gasEffects[0]?.intensity ?? 0}
            stirring={object.stir.kind === "stirring"}
            heating={object.thermal.kind === "heating"}
            label={object.label}
            selected={selected}
            hovered={hovered}
            agentActive={agentActive}
            size={size}
          />
        ) : (
          <InstrumentGlass
            type={object.type}
            reading={formatReading(object.lastReading)}
            attached={object.attachedTo !== null}
            heatLevel={object.type === "hotplate" && docked?.thermal.kind === "heating" ? 1 : 0}
            size={size}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
