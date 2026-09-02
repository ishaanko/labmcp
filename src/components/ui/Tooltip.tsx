"use client";

import type { ReactElement } from "react";
import { Tooltip as Base } from "@base-ui-components/react/tooltip";

export interface TooltipProps {
  label: string;
  /** Rendered as the trigger itself (base-ui `render`), so the child button is not nested in another. */
  children: ReactElement<Record<string, unknown>>;
}

/** Hover label for collapsed shelf icons and icon-only buttons. Gated to fine pointers by base-ui. */
export function Tooltip({ label, children }: TooltipProps) {
  return (
    <Base.Provider delay={300}>
      <Base.Root>
        <Base.Trigger render={children} />
        <Base.Portal>
          <Base.Positioner side="top" sideOffset={6}>
            <Base.Popup className="material-thin px-2 py-1 text-2xs text-ink-2 transition-[opacity,translate] duration-150 ease-out data-[starting-style]:opacity-0 data-[starting-style]:translate-y-0.5 data-[ending-style]:opacity-0">
              {label}
            </Base.Popup>
          </Base.Positioner>
        </Base.Portal>
      </Base.Root>
    </Base.Provider>
  );
}
