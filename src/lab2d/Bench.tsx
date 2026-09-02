"use client";

import { useLayoutEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useLabStore } from "@/store/labStore";
import { selectPublic } from "@/store/selectors";
import { BenchObject } from "./BenchObject";
import { AgentMarker } from "./effects/AgentMarker";
import { Drop } from "./effects/Drop";
import { PourStream } from "./effects/PourStream";
import { CELL_H, CELL_W, WORKSPACE_H, WORKSPACE_W, cellToPx } from "./grid";

const DOT_STYLE: CSSProperties = {
  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
  backgroundSize: `${CELL_W}px ${CELL_H}px`,
  backgroundPosition: `${CELL_W / 2}px ${CELL_H / 2}px`,
};

/** Midpoint of the objects' pixel extent; the workspace center when the bench is empty. */
function objectsCenterPx(points: ReadonlyArray<{ x: number; y: number }>): { x: number; y: number } {
  if (points.length === 0) return { x: WORKSPACE_W / 2, y: WORKSPACE_H / 2 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/**
 * The 2D bench: a black workspace on a static dotted grid, one `BenchObject` per lab object,
 * and an effects overlay (pour streams, drops, the agent marker). Clicking empty bench space
 * deselects; clicking an object is handled by that object's own drag hook and never reaches here
 * (its pointerdown target is a descendant, not the workspace root).
 *
 * The workspace is wider than the viewport once the side panels are open, so the scroll is
 * re-centered on the objects' extent on resize and whenever objects are added or removed.
 */
export function Bench() {
  // `selectPublic` memoizes `.objects` on lab identity; map to ids in render, not in the
  // selector, so the selector keeps returning a stable reference between renders.
  const objects = useLabStore((s) => selectPublic(s).objects);
  const viewportRef = useRef<HTMLDivElement>(null);
  const objectKey = objects.map((o) => o.id).join(",");

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const center = (): void => {
      const focus = objectsCenterPx(selectPublic(useLabStore.getState()).objects.map((o) => cellToPx(o.position)));
      el.scrollLeft = focus.x - el.clientWidth / 2;
      el.scrollTop = focus.y - el.clientHeight / 2;
    };
    center();
    const observer = new ResizeObserver(center);
    observer.observe(el);
    return () => observer.disconnect();
  }, [objectKey]);

  const onBackgroundPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget) return;
    useLabStore.getState().select(null);
  };

  return (
    <div ref={viewportRef} className="h-full w-full overflow-auto bg-black">
      <div
        data-bench-workspace
        className="relative bg-black"
        style={{ width: WORKSPACE_W, height: WORKSPACE_H, ...DOT_STYLE }}
        onPointerDown={onBackgroundPointerDown}
      >
        {objects.map((o) => (
          <BenchObject key={o.id} id={o.id} />
        ))}
        <PourStream />
        <Drop />
        <AgentMarker />
      </div>
    </div>
  );
}
