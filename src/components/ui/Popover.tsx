"use client";

import type { ReactNode } from "react";
import { Popover as Base } from "@base-ui-components/react/popover";
import { clsx } from "clsx";

export interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * Chrome popover anchored to its trigger (scenario details, WebMCP tool list, objective
 * steps). Vessel-anchored popovers with virtual elements belong to the drag/drop phase and
 * are not built here.
 */
export function Popover({ trigger, children, side = "bottom", align = "start", className }: PopoverProps) {
  return (
    <Base.Root>
      <Base.Trigger className="contents">{trigger}</Base.Trigger>
      <Base.Portal>
        <Base.Positioner side={side} align={align} sideOffset={8}>
          <Base.Popup
            className={clsx(
              "material-thick origin-[var(--transform-origin)] p-3 text-sm text-ink",
              "transition-[opacity,transform] duration-150 [--ease-out]",
              "data-[starting-style]:scale-96 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-96 data-[ending-style]:opacity-0",
              className,
            )}
          >
            {children}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}
