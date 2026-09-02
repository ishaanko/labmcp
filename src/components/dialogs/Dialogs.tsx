"use client";

import { AmountDialog } from "./AmountDialog";
import { PourDialog } from "./PourDialog";
import { ResetDialog } from "./ResetDialog";

/**
 * Mounts every `ui.dialog` popover, plus the reset confirmation. Each one gates on its own
 * dialog kind, so mounting all three unconditionally covers `add_reagent`, `add_indicator`,
 * `transfer`, and `confirm_reset`.
 */
export function Dialogs() {
  return (
    <>
      <AmountDialog />
      <PourDialog />
      <ResetDialog />
    </>
  );
}
