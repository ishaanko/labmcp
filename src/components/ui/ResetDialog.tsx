"use client";

import { AlertDialog as Base } from "@base-ui-components/react/alert-dialog";
import { useLabStore } from "@/store/labStore";
import { Button } from "./Button";

/**
 * Confirms a reset before reloading the current scenario at its seed. Centered, no scrim
 * motion beyond the shared 160ms popup timing (C4.8).
 */
export function ResetDialog() {
  const open = useLabStore((s) => s.ui.dialog?.kind === "confirm_reset");
  const openDialog = useLabStore((s) => s.openDialog);
  const dispatch = useLabStore((s) => s.dispatch);

  const close = (): void => openDialog(null);
  const confirm = (): void => {
    void dispatch({ kind: "RESET" }, "human");
    openDialog(null);
  };

  return (
    <Base.Root open={open} onOpenChange={(v) => !v && close()}>
      <Base.Portal>
        <Base.Backdrop className="fixed inset-0 z-40 bg-ink/20 transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Base.Popup className="material-thick fixed top-1/2 left-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 p-4 transition-[opacity,scale] duration-[160ms] ease-out data-[ending-style]:duration-[120ms] data-[starting-style]:scale-96 data-[starting-style]:opacity-0 data-[ending-style]:scale-96 data-[ending-style]:opacity-0">
          <Base.Title className="text-md font-semibold text-ink">Reset the lab?</Base.Title>
          <Base.Description className="mt-1 text-sm text-ink-2">
            This reloads the current scenario from its starting state. This cannot be undone.
          </Base.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Base.Close render={<Button variant="ghost" size="sm" />}>Cancel</Base.Close>
            <Button variant="danger" size="sm" onClick={confirm}>
              Reset
            </Button>
          </div>
        </Base.Popup>
      </Base.Portal>
    </Base.Root>
  );
}
