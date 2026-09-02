"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Copy } from "lucide-react";
import { checkTitrationAnswer, titrationSolution } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { selectPublic, selectTitration } from "@/store/selectors";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

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

/** The worked titration arithmetic, opened/closed via `ui.explainOpen`. Before reveal the
 * concentration is labelled as a curve estimate; after reveal it adds the true value and the
 * tolerance verdict. */
export function ExplainSheet() {
  const open = useLabStore((s) => s.ui.explainOpen);
  const setOpen = useLabStore((s) => s.setExplainOpen);
  const titration = useLabStore(selectTitration);
  const pub = useLabStore(selectPublic);
  const lab = useLabStore((s) => s.lab);
  const [copied, setCopied] = useState(false);

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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-[420px] gap-5 sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>Explain</SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
          <p className="tabular text-base text-foreground">HCl + NaOH &#8594; NaCl + H&#8322;O</p>

          <ul className="flex flex-col gap-2.5 text-sm">
            {rows.map((row, i) => (
              <motion.li
                key={row.text}
                initial={{ opacity: 0, transform: "translateY(-4px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{ duration: 0.2, delay: i * ROW_STAGGER_S }}
                className="tabular text-foreground/80"
              >
                {row.text}
              </motion.li>
            ))}
          </ul>

          {revealed && solution ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="text-foreground">True concentration: {solution.analyteM.toFixed(4)} M</p>
              {verdict ? (
                <p className={verdict.correct ? "mt-1 text-emerald-400" : "mt-1 text-destructive"}>
                  {(verdict.relError * 100).toFixed(1)}% off, {verdict.correct ? "within tolerance." : "outside tolerance."}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Estimate from the curve so far. Reveal to see the true value.</p>
          )}

          <Button variant="secondary" size="sm" onClick={copyText} className="mt-auto w-fit">
            <Copy size={13} />
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
