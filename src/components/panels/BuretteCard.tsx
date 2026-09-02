"use client";

import { Droplets } from "lucide-react";
import type { PublicContainer } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { containerInFrontOf, selectContainers } from "@/store/selectors";
import { Readout } from "./Readout";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { observe } from "@/components/ui/toasts";

export interface BuretteCardProps {
  readonly container: PublicContainer;
}

const INCREMENTS = [0.1, 0.5, 1, 5] as const;

/** Right-panel card for a selected burette: remaining volume, dispense increment, and a
 * Dispense button that targets whatever container sits one cell in front of it. */
export function BuretteCard({ container }: BuretteCardProps) {
  const dispatch = useLabStore((s) => s.dispatch);
  const increment = useLabStore((s) => s.ui.dispenseIncrementMl);
  const setIncrement = useLabStore((s) => s.setDispenseIncrement);
  const containers = useLabStore(selectContainers);

  const dispense = (): void => {
    const target = containerInFrontOf(container, containers);
    if (!target) {
      observe({ kind: "info", title: "Nothing under the burette. Drag a flask to the cell beneath it." });
      return;
    }
    void dispatch({ kind: "DISPENSE", buretteId: container.id, toId: target.id, volumeMl: increment }, "human");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{container.label}</h2>
        <p className="text-xs text-muted-foreground">burette</p>
      </div>

      <Readout label="Remaining" value={container.volumeMl} unit="mL" digits={2} size="lg" />

      <div>
        <p className="text-xs text-muted-foreground">Increment</p>
        <ToggleGroup value={[String(increment)]} onValueChange={(values) => { const v = values[0]; if (v) setIncrement(Number(v)); }} className="mt-1">
          {INCREMENTS.map((ml) => (
            <ToggleGroupItem key={ml} value={String(ml)} size="sm">
              {ml} mL
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="mt-auto flex flex-col items-start gap-1.5 border-t border-border pt-3">
        <Button size="sm" onClick={dispense} disabled={container.volumeMl <= 0}>
          <Droplets size={13} />
          Dispense
        </Button>
        <p className="text-xs text-muted-foreground">Press D</p>
      </div>
    </div>
  );
}
