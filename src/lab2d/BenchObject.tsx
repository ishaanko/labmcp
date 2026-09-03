"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, type Transition } from "motion/react";
import { assertNever, describeColor, rgbaToCss, type ContainerType, type InstrumentReading, type InstrumentType, type PublicContainer } from "@/engine";
import { Instrument as InstrumentGlass, Vessel } from "@/lab2d/glassware/Glassware";
import type { VesselPrecipitate } from "@/lab2d/glassware/types";
import { fmtC, fmtMl, fmtPh } from "@/lib/format";
import { useLabStore } from "@/store/labStore";
import { selectPublic } from "@/store/selectors";
import { useEffectsStore } from "./effectsStore";
import { cellToPx, dockedInstrumentPose, type XY } from "./grid";
import { objectBodyPx } from "./objectDom";
import { useBenchDrag } from "./useBenchDrag";

/** Rendered width per vessel type: each vessel's own viewBox is sized to these targets, so `size` maps 1:1 with no extra scaling. */
const VESSEL_SIZE: Readonly<Record<ContainerType, number>> = {
  beaker: 108,
  flask: 108,
  test_tube: 40,
  graduated_cylinder: 56,
  burette: 44,
};

/** Rendered width per instrument type, standalone on the bench (a hotplate is the same size either way; it never reads as "docked"). */
const INSTRUMENT_STANDALONE_SIZE: Readonly<Record<InstrumentType, number>> = {
  ph_meter: 76,
  thermometer: 44,
  hotplate: 120,
};

/** Rendered width per instrument type, docked at a container's shoulder. */
const INSTRUMENT_DOCKED_SIZE: Readonly<Record<InstrumentType, number>> = {
  ph_meter: 64,
  thermometer: 44,
  hotplate: 120,
};

/** A liquid's fill floor: engine colors read too faint to see against true black below this alpha. */
const LIQUID_ALPHA_FLOOR = 0.45;
/** Flat water blue for every colorless solution (the dock's `--role-water`); the engine's own base tint is a grey on black. */
const WATER_RGB = { r: 90, g: 210, b: 255 } as const;

const TILT_DEG = 20;
/** How far a dragged instrument's ghost leans toward the container it would dock on release. */
const ZONE_TILT_DEG = 8;
/** Lift for a container sharing a hotplate's cell: its floor (cell center + 65) rises to the plate top (cell center + 30). */
const HOTPLATE_LIFT = 34;
const PULSE_TRANSITION = { duration: 0.8, ease: "easeInOut" } as const;
const TILT_TRANSITION = { duration: 0.4, ease: "easeInOut" } as const;
const INSTANT_TRANSITION: Transition = { duration: 0 };
/** An instrument settling into or out of a dock: snappier and springier than a container's drop. */
const DOCK_SNAP_TRANSITION: Transition = { type: "spring", visualDuration: 0.32, bounce: 0.12 };
/**
 * A container being dropped onto pops briefly (`VesselFrame`'s own hover spring, ~200ms) before
 * settling back to its resting box; measuring its rim for a dock pose right as that attach
 * commits can catch it mid-pop. This is how long after an attach the pose is re-measured once
 * more, so the probe locks onto the container's true resting geometry, not a transient one.
 */
const DOCK_REMEASURE_MS = 300;

function liquidCss(container: PublicContainer): string {
  if (container.volumeMl <= 0) return rgbaToCss(container.color);
  const alpha = Math.max(container.color.a, LIQUID_ALPHA_FLOOR);
  const rgb = describeColor(container.color) === "colorless" ? WATER_RGB : container.color;
  return rgbaToCss({ ...rgb, a: alpha });
}

function precipitateFor(container: PublicContainer): VesselPrecipitate | null {
  const solid = container.solids[0];
  if (!solid) return null;
  return { color: rgbaToCss(solid.color), scale: solid.scale, suspended: solid.suspended };
}

/**
 * An attached probe reads its container live (`publicView` exposes pH once a meter is on it);
 * only a detached one falls back to the last MEASURE it took.
 */
function liveReading(type: InstrumentType, docked: PublicContainer | undefined, lastReading: InstrumentReading | null): string | null {
  if (docked && type === "ph_meter" && docked.pH !== null) return fmtPh(docked.pH);
  if (docked && type === "thermometer") return fmtC(docked.temperatureC);
  return formatReading(lastReading);
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

/** Stacking: a hotplate sits under the container standing on it; every other instrument docks above glass. */
function zIndexFor(kind: "container" | "instrument", type: string): number {
  if (kind === "container") return 10;
  return type === "hotplate" ? 5 : 20;
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
  const reducedMotion = useLabStore((s) => s.ui.reducedMotion);
  // The container the pointer is currently over a drop zone for, while dragging this (or any) instrument; only meaningful when `object` is the one being dragged.
  const hoveredContainer = useLabStore((s) => {
    if (!s.ui.hoveredId) return undefined;
    const o = selectPublic(s).objects.find((x) => x.id === s.ui.hoveredId);
    return o && o.kind === "container" ? o : undefined;
  });
  const tilting = useEffectsStore((s) => s.tiltIds.has(id));
  const pulsing = useEffectsStore((s) => s.pulseIds.has(id));
  const agentActive = useEffectsStore((s) => s.agentActiveIds.has(id));
  const pourTargetId = useEffectsStore((s) => s.pours.find((p) => p.sourceId === id && p.kind === "stream")?.targetId);
  const targetObject = useLabStore((s) => (pourTargetId ? selectPublic(s).objects.find((o) => o.id === pourTargetId) : undefined));

  // A container stands on a hotplate by sharing its cell (never by `attachedTo`), so the glow keys off cell position, matching `engine/physical.ts`'s `hotplateAt`.
  const heatingOnCell = useLabStore((s) =>
    object !== undefined && object.kind === "instrument" && object.type === "hotplate"
      ? selectPublic(s).objects.some(
          (o) => o.kind === "container" && o.thermal.kind === "heating" && o.position.x === object.position.x && o.position.y === object.position.y,
        )
      : false,
  );

  // The mirror case: this container stands on a hotplate. It lifts onto the plate rim and drops its caption; the plate's caption names the stack.
  const onHotplate = useLabStore((s) =>
    object !== undefined && object.kind === "container"
      ? selectPublic(s).objects.some((o) => o.kind === "instrument" && o.type === "hotplate" && o.position.x === object.position.x && o.position.y === object.position.y)
      : false,
  );

  const docked = object && object.kind === "instrument" && attachedContainer && attachedContainer.kind === "container" ? attachedContainer : undefined;
  const dockedContainerId = docked?.id;

  // Re-measured whenever the store settles (`stateVersion` ticks on every commit) and once more
  // `DOCK_REMEASURE_MS` after attaching, so a volume change, the host container moving, or its
  // own hover pop settling back down all keep the probe pinned to its true rim, not a stale rect.
  const stateVersion = useLabStore((s) => s.stateVersion);
  const [remeasureTick, setRemeasureTick] = useState(0);
  useEffect(() => {
    if (!dockedContainerId) return undefined;
    const timeout = window.setTimeout(() => setRemeasureTick((t) => t + 1), DOCK_REMEASURE_MS);
    return () => window.clearTimeout(timeout);
  }, [dockedContainerId]);

  const pose = useMemo(() => {
    if (!docked || !object || object.kind !== "instrument") return null;
    const bodyPx = objectBodyPx(docked.id);
    if (!bodyPx) return null;
    return dockedInstrumentPose(docked, bodyPx, object.type);
    // stateVersion/remeasureTick aren't read above; they're triggers to re-measure the container's DOM rect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docked, object, stateVersion, remeasureTick]);
  const restPx: XY = useMemo(() => {
    if (!object) return { x: 0, y: 0 };
    if (pose) return pose.bodyPx;
    return cellToPx(object.position);
  }, [object, pose]);

  const isBurette = object !== undefined && object.kind === "container" && object.type === "burette";
  const isInstrument = object?.kind === "instrument";
  const drag = useBenchDrag(id, isInstrument ? "instrument" : "container", { isBurette, restPx, docked: docked !== undefined });

  if (!object) return null;

  const pos = drag.livePx ?? restPx;
  const selected = selectedId === id;
  const hovered = hoveredId === id;

  const tiltDeg = tilting && targetObject ? (targetObject.position.x >= object.position.x ? -TILT_DEG : TILT_DEG) : 0;
  // While dragging this instrument over a valid drop zone, lean its ghost toward the container it would dock on release.
  const zoneTiltDeg =
    !reducedMotion && drag.dragging && object.kind === "instrument" && hoveredContainer
      ? cellToPx(hoveredContainer.position).x >= pos.x
        ? ZONE_TILT_DEG
        : -ZONE_TILT_DEG
      : 0;
  const size =
    object.kind === "container" ? VESSEL_SIZE[object.type] : docked ? INSTRUMENT_DOCKED_SIZE[object.type] : INSTRUMENT_STANDALONE_SIZE[object.type];

  const positionTransition: Transition = reducedMotion
    ? INSTANT_TRANSITION
    : drag.dragging
      ? INSTANT_TRANSITION
      : object.kind === "instrument" && drag.justReleased
        ? DOCK_SNAP_TRANSITION
        : { type: "spring", visualDuration: 0.35, bounce: drag.justReleased ? 0.2 : 0 };

  return (
    <motion.div
      data-object-id={id}
      className="pointer-events-none absolute left-0 top-0 touch-none select-none"
      style={{ zIndex: drag.dragging ? 30 : zIndexFor(object.kind, object.type) }}
      animate={{ x: pos.x, y: pos.y - (onHotplate && !drag.dragging ? HOTPLATE_LIFT : 0), scale: drag.dragging ? 1.03 : 1 }}
      transition={positionTransition}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerCancel}
    >
      <motion.div
        className={
          isBurette
            ? "-translate-x-1/2 -translate-y-1/2 cursor-pointer"
            : "-translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
        }
        animate={{ rotate: zoneTiltDeg || tiltDeg, scale: pulsing ? [1, 1.04, 1] : 1 }}
        transition={reducedMotion ? INSTANT_TRANSITION : { rotate: TILT_TRANSITION, scale: PULSE_TRANSITION }}
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
            label={onHotplate ? "" : object.label}
            selected={selected}
            hovered={hovered}
            agentActive={agentActive}
            size={size}
          />
        ) : (
          <InstrumentGlass
            type={object.type}
            reading={liveReading(object.type, docked, object.lastReading)}
            attached={object.attachedTo !== null}
            heatLevel={heatingOnCell ? 1 : 0}
            size={size}
            dockDepthPx={pose?.tipDepthPx}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
