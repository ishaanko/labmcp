"use client";

import { Droplets } from "lucide-react";
import type { PublicContainer } from "@/engine";
import { useLabStore } from "@/store/labStore";
import { containerInFrontOf, selectContainers } from "@/store/selectors";
import { Readout } from "@/components/ui-legacy/Readout";
import { ChipButton } from "@/components/ui-legacy/Chip";
import { Button } from "@/components/ui-legacy/Button";
import { observe } from "@/components/ui-legacy/toasts";

export interface BuretteCardProps {
  readonly container: PublicContainer;
}

const INCREMENTS = [0.1, 0.5, 1, 5] as const;

/** Right-panel card for a selected burette (C4.5): remaining volume, dispense increment, and a
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
        <h2 className="text-md font-semibold text-ink">{container.label}</h2>
        <p className="text-2xs text-ink-3">burette</p>
      </div>

      <Readout label="Remaining" value={container.volumeMl} unit="mL" digits={2} size="lg" />

      <div>
        <p className="text-2xs text-ink-3">Increment</p>
        <div className="mt-1 flex gap-1.5">
          {INCREMENTS.map((ml) => (
            <ChipButton key={ml} active={increment === ml} onClick={() => setIncrement(ml)}>
              {ml} mL
            </ChipButton>
          ))}
        </div>
      </div>

      <div className="mt-auto flex flex-col items-start gap-1.5 border-t border-hairline pt-3">
        <Button size="sm" onClick={dispense} disabled={container.volumeMl <= 0}>
          <Droplets size={13} />
          Dispense
        </Button>
        <p className="text-2xs text-ink-3">Press D</p>
      </div>
    </div>
  );
}
