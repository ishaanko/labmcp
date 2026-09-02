"use client";

import { AnimatePresence, motion } from "motion/react";
import { useLabStore } from "@/store/labStore";
import { selectSelected } from "@/store/selectors";
import { SelectionCard } from "./SelectionCard";
import { BenchSummary } from "./BenchSummary";

/** Persistent right panel: selected object, else a bench summary. Crossfades, never slides. */
export function ContextPanel() {
  const selected = useLabStore(selectSelected);
  const key = selected ? selected.id : "bench";

  return (
    <div className="material pointer-events-auto flex h-full w-[300px] max-[1100px]:w-[280px] flex-col overflow-hidden p-4">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {selected ? <SelectionCard object={selected} /> : <BenchSummary />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
