"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type { Container } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { containerInFrontOf } from "@/store/selectors";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/** First burette on the bench and the container sitting directly in front of it (grid y + 1). */
function firstBuretteDispenseTargets(): { readonly buretteId: Container["id"]; readonly toId: Container["id"] } | null {
  const objects = useLabStore.getState().lab.objects;
  const burette = objects.find((o): o is Container => o.kind === "container" && o.type === "burette");
  if (!burette) return null;
  const front = containerInFrontOf(burette, objects);
  return front ? { buretteId: burette.id, toId: front.id } : null;
}

function selectedContainer(): Container | undefined {
  const { lab, ui } = useLabStore.getState();
  if (!ui.selectedId) return undefined;
  const obj = lab.objects.find((o) => o.id === ui.selectedId);
  return obj && obj.kind === "container" ? obj : undefined;
}

/**
 * Global bench shortcuts (C4.8): Cmd/Ctrl+Z undo, D dispense from the first burette, Esc
 * close/deselect, Delete/Backspace dispose the selection (with an undo toast), S stir it, R
 * opens the reset confirmation. Ignored while an input/textarea/contenteditable has focus so
 * typing in a dialog never triggers one.
 */
export function useKeyboard(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (isTypingTarget(e.target)) return;
      const store = useLabStore.getState();

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void store.dispatch({ kind: "UNDO" }, "human");
        return;
      }

      switch (e.key) {
        case "d":
        case "D": {
          const targets = firstBuretteDispenseTargets();
          if (!targets) return;
          void store.dispatch({ kind: "DISPENSE", buretteId: targets.buretteId, toId: targets.toId, volumeMl: store.ui.dispenseIncrementMl }, "human");
          return;
        }
        case "s":
        case "S": {
          const container = selectedContainer();
          if (!container) return;
          void store.dispatch({ kind: "STIR", containerId: container.id }, "human");
          return;
        }
        case "r":
        case "R":
          store.openDialog({ kind: "confirm_reset" });
          return;
        case "Escape":
          if (store.ui.dialog) store.openDialog(null);
          else store.select(null);
          return;
        case "Delete":
        case "Backspace": {
          const container = selectedContainer();
          if (!container) return;
          const containerId = container.id;
          void store.dispatch({ kind: "DISPOSE", containerId }, "human").then((result) => {
            if (!result.ok) return;
            toast("Disposed contents.", {
              action: { label: "Undo", onClick: () => void useLabStore.getState().dispatch({ kind: "UNDO" }, "human") },
            });
          });
          return;
        }
        default:
          return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
