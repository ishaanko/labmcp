import NumberFlow from "@number-flow/react";
import { clsx } from "clsx";

export interface ReadoutProps {
  value: number | null;
  unit?: string;
  digits?: number;
  label: string;
  size?: "sm" | "lg";
  className?: string;
}

const TRANSFORM_TIMING: EffectTiming = { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" };
const SPIN_TIMING: EffectTiming = { duration: 250, easing: "cubic-bezier(0.23, 1, 0.32, 1)" };

/** Numeric readout with the C7 NumberFlow timings. `value === null` renders a dash (no probe, no pH). */
export function Readout({ value, unit, digits = 2, label, size = "sm", className }: ReadoutProps) {
  return (
    <div className={clsx("flex flex-col gap-0.5", className)}>
      <span className="text-2xs text-ink-3">{label}</span>
      {value === null ? (
        <span className={clsx("tabular text-ink-3", size === "lg" ? "text-readout" : "text-md")}>–</span>
      ) : (
        <NumberFlow
          value={Number(value.toFixed(digits))}
          format={{ minimumFractionDigits: digits, maximumFractionDigits: digits }}
          suffix={unit ? ` ${unit}` : undefined}
          transformTiming={TRANSFORM_TIMING}
          spinTiming={SPIN_TIMING}
          className={clsx("tabular text-ink", size === "lg" ? "text-readout" : "text-md")}
        />
      )}
    </div>
  );
}
