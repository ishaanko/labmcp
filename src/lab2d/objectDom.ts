/**
 * DOM lookups keyed by `data-object-id`, the attribute every `BenchObject` root carries. Kept
 * separate from `BenchObject.tsx` so drag/drop hit-testing and the chrome lane's popover
 * anchoring (`objectRect`) share one source of truth for "where is object X on screen".
 */

function selectorFor(id: string): string {
  return `[data-object-id="${CSS.escape(id)}"]`;
}

/** The mounted DOM node for a bench object, or null if it is not on screen. */
export function getObjectElement(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(selectorFor(id));
}

/**
 * Viewport-space bounding box of a bench object's drawn body, for popover anchoring. The root is a
 * zero-size point at the cell center (its body is a -50% translated child), so a popover placed
 * beside the root would overlap the glass. Includes the caption below the glass when one is
 * showing (a generous box is fine for a popover anchor or a drop zone; use `objectSvgRect` where
 * the glass's exact edges matter).
 */
export function objectRect(id: string): DOMRect | null {
  const root = getObjectElement(id);
  if (!root) return null;
  return (root.firstElementChild ?? root).getBoundingClientRect();
}

/**
 * Viewport-space bounding box of a bench object's own `<svg>` art alone, excluding any caption
 * below it (a caption can be taller or wider than the glass, e.g. "Grad. cylinder" over a 56px
 * vessel, which would throw off a rim- or shoulder-relative calculation reading `objectRect`
 * instead). What `dockedInstrumentPose` measures a container against.
 */
export function objectSvgRect(id: string): DOMRect | null {
  const root = getObjectElement(id);
  return root?.querySelector("svg")?.getBoundingClientRect() ?? null;
}

const BENCH_WORKSPACE_SELECTOR = "[data-bench-workspace]";

export interface WorkspaceRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * A bench object's own `<svg>` art, in workspace-local coordinates (the same space `cellToPx`
 * positions objects in), so `dockedInstrumentPose` can place a probe against a container's true
 * on-screen rim without duplicating the bench's own box-model math (caption height, hover scale).
 * Null before both the workspace and the object have mounted.
 */
export function objectBodyPx(id: string): WorkspaceRect | null {
  const svgRect = objectSvgRect(id);
  const origin = document.querySelector(BENCH_WORKSPACE_SELECTOR)?.getBoundingClientRect();
  if (!svgRect || !origin) return null;
  return { left: svgRect.left - origin.left, top: svgRect.top - origin.top, width: svgRect.width, height: svgRect.height };
}

/**
 * Bench object ids stacked under a client point, nearest first, deduplicated (a docked
 * instrument nests inside its container's root, so both can appear) and with `excludeId`
 * dropped (the object being dragged sits directly under its own pointer).
 */
export function objectIdsAtPoint(clientX: number, clientY: number, excludeId?: string): ReadonlyArray<string> {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    const owner = el.closest("[data-object-id]");
    const id = owner?.getAttribute("data-object-id");
    if (!id || id === excludeId || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** The topmost bench object under a client point, excluding `excludeId`. */
export function hitTestObject(clientX: number, clientY: number, excludeId?: string): string | null {
  return objectIdsAtPoint(clientX, clientY, excludeId)[0] ?? null;
}

/**
 * The best drop target for an instrument among `containerIds`, from a client point: the
 * container whose bounding rect, inflated by `inflatePx` on every side, contains the point
 * (nearest center wins a tie), or, failing that, any container within `centerRadiusPx` of its
 * center. A wide, forgiving zone, so the user does not have to land exactly on the glass to dock
 * a probe. Null when no container qualifies (id missing from the DOM counts as disqualified).
 */
export function instrumentDropTarget(
  clientX: number,
  clientY: number,
  containerIds: ReadonlyArray<string>,
  inflatePx: number,
  centerRadiusPx: number,
): string | null {
  let best: { id: string; distSq: number } | null = null;
  let nearestCenter: { id: string; distSq: number } | null = null;

  for (const id of containerIds) {
    const rect = objectRect(id);
    if (!rect) continue;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const distSq = (clientX - cx) ** 2 + (clientY - cy) ** 2;

    const insideInflated = clientX >= rect.left - inflatePx && clientX <= rect.right + inflatePx && clientY >= rect.top - inflatePx && clientY <= rect.bottom + inflatePx;
    if (insideInflated && (!best || distSq < best.distSq)) best = { id, distSq };
    if (distSq <= centerRadiusPx * centerRadiusPx && (!nearestCenter || distSq < nearestCenter.distSq)) nearestCenter = { id, distSq };
  }

  return (best ?? nearestCenter)?.id ?? null;
}
