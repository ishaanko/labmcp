"use client";

import { useEffect, useState } from "react";
import { projectObjectBounds } from "@/scene/sceneRefs";

/**
 * Screen-space bounds of a scene object, refreshed every animation frame while `objectId` is
 * set (C4.4 popover anchoring). Feeds the virtual element a base-ui `Popover.Positioner`
 * anchors to; `null` while the object is off-screen or `objectId` is `null`.
 */
export function useProjectedRect(objectId: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (objectId === null) return undefined;
    let raf = 0;
    const tick = (): void => {
      setRect(projectObjectBounds(objectId));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [objectId]);

  return objectId === null ? null : rect;
}
