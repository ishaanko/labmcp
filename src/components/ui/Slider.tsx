"use client";

import { Slider as Base } from "@base-ui-components/react/slider";

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  "aria-label": string;
}

/** Amount/temperature slider (C4.4, C4.7). NumberFlow reads the same value elsewhere. */
export function Slider({ value, min, max, step = 0.5, onChange, onCommit, "aria-label": ariaLabel }: SliderProps) {
  return (
    <Base.Root
      value={value}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      onValueChange={(v) => onChange(Array.isArray(v) ? (v[0] ?? min) : v)}
      onValueCommitted={(v) => onCommit?.(Array.isArray(v) ? (v[0] ?? min) : v)}
      className="flex w-full items-center py-1"
    >
      <Base.Control className="relative flex h-5 w-full items-center">
        <Base.Track className="h-1 w-full rounded-full bg-hairline-strong">
          <Base.Indicator className="h-full rounded-full bg-accent" />
        </Base.Track>
        <Base.Thumb className="pressable h-4 w-4 rounded-full border border-hairline bg-surface-solid shadow-chip outline-none focus-visible:outline-2 focus-visible:outline-accent-ring focus-visible:outline-offset-2" />
      </Base.Control>
    </Base.Root>
  );
}
