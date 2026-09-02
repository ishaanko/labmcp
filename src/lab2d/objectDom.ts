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
 * beside the root would overlap the glass.
 */
export function objectRect(id: string): DOMRect | null {
  const root = getObjectElement(id);
  if (!root) return null;
  return (root.firstElementChild ?? root).getBoundingClientRect();
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
