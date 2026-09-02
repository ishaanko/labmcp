"use client";

import { AmountPopover } from "./AmountPopover";
import { PourPopover } from "./PourPopover";

/**
 * Mounts every `ui.dialog` popover except `confirm_reset`, which `ResetDialog` already owns.
 * Each popover gates on its own dialog kind, so mounting both unconditionally is enough to
 * cover `add_reagent`, `add_indicator`, and `transfer`.
 */
export function Dialogs() {
  return (
    <>
      <AmountPopover />
      <PourPopover />
    </>
  );
}
