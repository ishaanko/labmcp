"use client";

import type { ReactNode } from "react";
import { Dialog as Base } from "@base-ui-components/react/dialog";
import { clsx } from "clsx";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** Centered modal for amount and pour prompts. 160ms open per C4.8. */
export function Dialog({ open, onOpenChange, title, description, children, className }: DialogProps) {
  return (
    <Base.Root open={open} onOpenChange={onOpenChange}>
      <Base.Portal>
        <Base.Backdrop className="fixed inset-0 z-40 bg-ink/20 transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Base.Popup
          className={clsx(
            "material-thick fixed top-1/2 left-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 p-4",
            "transition-[opacity,scale] duration-[160ms] ease-out data-[ending-style]:duration-[120ms]",
            "data-[starting-style]:scale-96 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-96 data-[ending-style]:opacity-0",
            className,
          )}
        >
          <Base.Title className="text-md font-semibold text-ink">{title}</Base.Title>
          {description ? <Base.Description className="mt-1 text-sm text-ink-2">{description}</Base.Description> : null}
          <div className="mt-3">{children}</div>
        </Base.Popup>
      </Base.Portal>
    </Base.Root>
  );
}
