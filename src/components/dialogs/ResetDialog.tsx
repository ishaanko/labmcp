"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLabStore } from "@/store/labStore";

/** Confirms a reset before reloading the current scenario at its seed. */
export function ResetDialog() {
  const open = useLabStore((s) => s.ui.dialog?.kind === "confirm_reset");
  const openDialog = useLabStore((s) => s.openDialog);
  const dispatch = useLabStore((s) => s.dispatch);

  const confirm = (): void => {
    void dispatch({ kind: "RESET" }, "human");
    openDialog(null);
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && openDialog(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset the lab?</AlertDialogTitle>
          <AlertDialogDescription>This reloads the current scenario from its starting state. This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm}>
            Reset
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
