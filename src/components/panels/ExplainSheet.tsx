"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Copy, X } from "lucide-react";
import { checkTitrationAnswer, titrationSolution } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { selectPublic, selectTitration } from "@/store/selectors";
import { Button } from "@/components/ui/Button";

const SHEET_WIDTH = 420;
const ROW_STAGGER_S = 0.04;

interface EquationRow {
  readonly text: string;
}

function buildRows(analyteMl: number, titrantM: number, usedMl: number): ReadonlyArray<EquationRow> {
  const nNaohMmol = titrantM * usedMl;
  const nHclMmol = nNaohMmol;
  const cHcl = nHclMmol / analyteMl;
  return [
    { text: `n(NaOH) = c × V = ${titrantM.toFixed(3)} M × ${usedMl.toFixed(2)} mL = ${nNaohMmol.toFixed(3)} mmol` },
    { text: `1:1 → n(HCl) = ${nHclMmol.toFixed(3)} mmol` },
    { text: `c(HCl) = ${nHclMmol.toFixed(3)} mmol / ${analyteMl.toFixed(2)} mL = ${cHcl.toFixed(4)} M` },
  ];
}

/**
 * Right sheet (C7): the worked titration arithmetic. Opens/closes via `ui.explainOpen`, no
 * scrim, transform-only 320ms `--ease-drawer` slide in (240ms out), crossfading instead under
 * reduced motion. Before reveal the concentration is labelled as a curve estimate; after reveal
 * it adds the true value and the tolerance verdict.
 */
export function ExplainSheet() {
  const open = useLabStore((s) => s.ui.explainOpen);
  const setOpen = useLabStore((s) => s.setExplainOpen);
  const titration = useLabStore(selectTitration);
  const pub = useLabStore(selectPublic);
  const lab = useLabStore((s) => s.lab);
  const reduceMotion = useLabStore((s) => s.ui.reducedMotion);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (pub.scenario.kind !== "titration" || !titration) return null;
  const { analyteMl, titrantM, revealed } = pub.scenario;
  const usedMl = titration.endpointMl ?? titration.cumulativeTitrantMl;
  const rows = buildRows(analyteMl, titrantM, usedMl);
  const claimedM = (titrantM * usedMl) / analyteMl;
  const solution = revealed ? titrationSolution(lab) : null;
  const verdict = revealed ? checkTitrationAnswer(lab, claimedM) : null;

  const copyText = (): void => {
    const lines = [
      "HCl + NaOH -> NaCl + H2O",
      ...rows.map((r) => r.text),
      solution ? `True concentration: ${solution.analyteM.toFixed(4)} M` : titration.endpointMl == null ? "Estimate: dispense to the endpoint first." : "Estimate, not yet revealed.",
    ];
    void navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="explain-sheet"
          initial={reduceMotion ? { opacity: 0 } : { transform: `translateX(${SHEET_WIDTH}px)` }}
          animate={reduceMotion ? { opacity: 1 } : { transform: "translateX(0px)" }}
          exit={
            reduceMotion
              ? { opacity: 0, transition: { duration: 0.15 } }
              : { transform: `translateX(${SHEET_WIDTH}px)`, transition: { duration: 0.24, ease: [0.32, 0.72, 0, 1] } }
          }
          transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          className="material-thick pointer-events-auto fixed top-0 right-0 z-30 flex h-full flex-col gap-4 p-5"
          style={{ width: SHEET_WIDTH }}
          role="dialog"
          aria-label="Explain the titration"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-md font-semibold text-ink">Explain</h2>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
              <X size={15} />
            </Button>
          </div>

          <p className="tabular text-md text-ink">HCl + NaOH &#8594; NaCl + H&#8322;O</p>

          <ul className="flex flex-col gap-2.5 text-sm">
            {rows.map((row, i) => (
              <motion.li
                key={row.text}
                initial={{ opacity: 0, transform: "translateY(-4px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{ duration: 0.2, delay: i * ROW_STAGGER_S }}
                className="tabular text-ink-2"
              >
                {row.text}
              </motion.li>
            ))}
          </ul>

          {revealed && solution ? (
            <div className="rounded-md border border-hairline bg-surface-thin p-3 text-sm">
              <p className="text-ink">True concentration: {solution.analyteM.toFixed(4)} M</p>
              {verdict ? (
                <p className={verdict.correct ? "mt-1 text-ok" : "mt-1 text-danger"}>
                  {(verdict.relError * 100).toFixed(1)}% off, {verdict.correct ? "within tolerance." : "outside tolerance."}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-ink-3">Estimate from the curve so far. Reveal to see the true value.</p>
          )}

          <Button variant="secondary" size="sm" onClick={copyText} className="mt-auto w-fit">
            <Copy size={13} />
            {copied ? "Copied" : "Copy"}
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
