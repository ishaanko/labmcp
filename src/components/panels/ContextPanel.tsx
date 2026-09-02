"use client";

import { AnimatePresence, motion } from "motion/react";
import { MessageSquareText } from "lucide-react";
import { useLabStore } from "@/store/labStore";
import { selectSelected } from "@/store/selectors";
import { SelectionCard } from "./SelectionCard";
import { BenchSummary } from "./BenchSummary";
import { ObjectiveCard } from "./ObjectiveCard";
import { TitrationReadouts } from "./TitrationReadouts";
import { TitrationCurve } from "./TitrationCurve";
import { BuretteCard } from "./BuretteCard";
import { HotplateCard } from "./HotplateCard";
import { Button } from "@/components/ui/button";

function panelKeyFor(selectedId: string | undefined, inTitration: boolean): string {
  if (selectedId) return selectedId;
  return inTitration ? "titration-objective" : "bench";
}

function PanelContent() {
  const selected = useLabStore(selectSelected);
  const scenarioKind = useLabStore((s) => s.lab.scenario.kind);

  if (selected) {
    if (selected.kind === "container" && selected.type === "burette") return <BuretteCard container={selected} />;
    if (selected.kind === "instrument" && selected.type === "hotplate") return <HotplateCard instrument={selected} />;
    return <SelectionCard object={selected} />;
  }

  if (scenarioKind === "titration") {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <ObjectiveCard />
        <TitrationReadouts />
        <TitrationCurve />
      </div>
    );
  }

  return <BenchSummary />;
}

/** Persistent 320px right panel: selected object, else the titration objective, else a bench summary. */
export function ContextPanel() {
  const selected = useLabStore(selectSelected);
  const scenarioKind = useLabStore((s) => s.lab.scenario.kind);
  const setExplainOpen = useLabStore((s) => s.setExplainOpen);
  const key = panelKeyFor(selected?.id, scenarioKind === "titration");

  return (
    <div className="pointer-events-auto flex w-80 shrink-0 flex-col overflow-y-auto border-l border-border bg-card p-4">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1, ease: [0.23, 1, 0.32, 1] } }}
          transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
          className="flex flex-col"
        >
          <PanelContent />
        </motion.div>
      </AnimatePresence>
      {scenarioKind === "titration" ? (
        <Button variant="ghost" size="sm" onClick={() => setExplainOpen(true)} className="mt-3 w-fit shrink-0">
          <MessageSquareText size={13} />
          Explain
        </Button>
      ) : null}
    </div>
  );
}
