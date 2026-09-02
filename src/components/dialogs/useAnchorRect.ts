"use client";

import { useEffect, useState } from "react";
import { objectRect } from "@/lab2d/objectDom";

/**
 * Screen-space bounds of a bench object, refreshed every animation frame while `objectId` is
 * set (amount/pour dialog anchoring). Feeds the virtual element a base-ui `Popover`'s `anchor`
 * takes; `null` while the object is off-screen or `objectId` is `null`.
 */
export function useAnchorRect(objectId: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (objectId === null) return undefined;
    let raf = 0;
    const tick = (): void => {
      setRect(objectRect(objectId));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [objectId]);

  return objectId === null ? null : rect;
}
