import NumberFlow from "@number-flow/react";
import { clsx } from "clsx";
import { FAST_FLOW } from "@/lib/numberFlowTiming";

export interface ReadoutProps {
  value: number | null;
  unit?: string;
  digits?: number;
  label: string;
  size?: "sm" | "lg";
  className?: string;
  /** Shown in place of the dash when `value` is null (default "–"), e.g. "no probe". */
  emptyLabel?: string;
}

/** Numeric readout with tabular digits. `value === null` renders a dash (no probe, no pH). */
export function Readout({ value, unit, digits = 2, label, size = "sm", className, emptyLabel = "–" }: ReadoutProps) {
  return (
    <div className={clsx("flex flex-col gap-0.5", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {value === null ? (
        <span className={clsx("tabular text-muted-foreground", size === "lg" ? "text-2xl" : "text-base")}>{emptyLabel}</span>
      ) : (
        <NumberFlow
          {...FAST_FLOW}
          value={Number(value.toFixed(digits))}
          format={{ minimumFractionDigits: digits, maximumFractionDigits: digits }}
          suffix={unit ? ` ${unit}` : undefined}
          className={clsx("tabular text-foreground", size === "lg" ? "text-2xl" : "text-base")}
        />
      )}
    </div>
  );
}
