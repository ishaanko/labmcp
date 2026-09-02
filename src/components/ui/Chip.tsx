import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

const chip = cva(
  "inline-flex items-center gap-1.5 rounded-xs border text-xs font-medium leading-none whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-hairline bg-surface-thin text-ink-2",
        accent: "border-accent-ring/40 bg-accent-soft text-accent-ink",
        ok: "border-hairline bg-surface-thin text-ok",
        warn: "border-hairline bg-surface-thin text-warn",
      },
      size: {
        sm: "h-6 px-2",
        md: "h-7 px-2.5",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export interface ChipProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof chip> {}

/** Static label pill (objective, WebMCP status, source badge base). Not pressable. */
export function Chip({ className, tone, size, ...props }: ChipProps) {
  return <span className={clsx(chip({ tone, size }), className)} {...props} />;
}

export interface ChipButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof chip> {
  active?: boolean;
}

/** Pressable chip (reagent swatch, dispense increment, preset amount). */
export const ChipButton = forwardRef<HTMLButtonElement, ChipButtonProps>(function ChipButton(
  { className, tone, size, active, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(
        chip({ tone: active ? "accent" : tone, size }),
        "pressable hover:bg-surface-thick disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
});
