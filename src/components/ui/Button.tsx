import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

const button = cva(
  "pressable inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm text-sm font-medium disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent-ring focus-visible:outline-offset-2",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white hover:brightness-105",
        secondary: "bg-surface-thick text-ink border border-hairline hover:bg-surface-thin",
        ghost: "text-ink-2 hover:bg-surface-thin hover:text-ink",
        danger: "bg-danger text-white hover:brightness-105",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-9 px-3.5",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {}

/** Base pressable control. Every clickable chrome element in the app renders through this. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, ...props },
  ref,
) {
  return <button ref={ref} className={clsx(button({ variant, size }), className)} {...props} />;
});
