import type { LabState } from "@/engine";
import type { LabStore } from "./types";

interface TickableStore {
  getState(): LabStore;
}

/** True while anything in the lab is animating on its own: thermal ramps, stirring, settling solids, or gas. */
export function needsTick(lab: LabState): boolean {
  return lab.objects.some((o) => {
    if (o.kind !== "container") return false;
    if (o.thermal.kind !== "idle") return true;
    if (o.stir.kind === "stirring") return true;
    if (o.solids.some((s) => s.suspended > 0)) return true;
    if (o.gasEffects.length > 0) return true;
    return false;
  });
}

const TICK_MS = 250;
const TICK_DT_S = 0.25;

/** Dispatches TICK at 4 Hz as 'system' only while needsTick(lab); idles otherwise. */
export function startTicker(store: TickableStore): () => void {
  const id = setInterval(() => {
    const lab = store.getState().lab;
    if (!needsTick(lab)) return;
    void store.getState().dispatch({ kind: "TICK", dtS: TICK_DT_S }, "system");
  }, TICK_MS);
  return () => clearInterval(id);
}
