"use client";

import { Bench } from "@/lab2d/Bench";
import { useLabStore } from "@/store/labStore";

/**
 * bench-2d's own preview: the real store and a couple of buttons to script a dispense for
 * screenshots, no dev console required. Not part of the shipped app shell.
 */
export default function BenchDevPage() {
  const runDispense = (): void => {
    const store = useLabStore.getState();
    const scenario = store.lab.scenario;
    if (scenario.kind !== "titration") return;
    void store.dispatch({ kind: "DISPENSE", buretteId: scenario.buretteId, toId: scenario.flaskId, volumeMl: 1 }, "human");
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-black">
      <div className="flex gap-2 border-b border-white/10 p-2">
        <button type="button" onClick={runDispense} className="rounded-md border border-white/20 px-3 py-1 text-sm text-white">
          Script: dispense
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <Bench />
      </div>
    </div>
  );
}
