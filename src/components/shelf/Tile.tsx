import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { clsx } from "clsx";

export interface TileProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly color: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly dragging?: boolean;
}

/**
 * Little Alchemy-style dock tile: 64x64, rounded-xl, a 20%-alpha fill and a 2px border in the
 * reagent/equipment's role color, the flat icon centered, the label underneath. Shared by
 * `ReagentChip`, `EquipmentButton`, and `ReagentGhost` (the ghost renders the same markup
 * without the `<button>` semantics, since it is a drag clone, not a control).
 */
export const Tile = forwardRef<HTMLButtonElement, TileProps>(function Tile(
  { color, label, icon, dragging, className, style, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={clsx("tile-lift flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl px-1 pt-2 pb-1.5", dragging && "opacity-40", className)}
      style={{ ...style }}
      {...props}
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-xl border-2"
        style={{ background: `color-mix(in oklch, ${color} 20%, transparent)`, borderColor: color, color }}
      >
        {icon}
      </span>
      <span className="w-full truncate text-center text-xs text-foreground/80">{label}</span>
    </button>
  );
});

export interface TileFaceProps {
  readonly color: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly className?: string;
}

/** The same face as `Tile`, without button semantics: the drag ghost's clone. */
export function TileFace({ color, label, icon, className }: TileFaceProps) {
  return (
    <div className={clsx("flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl px-1 pt-2 pb-1.5", className)}>
      <span
        className="flex h-11 w-11 items-center justify-center rounded-xl border-2"
        style={{ background: `color-mix(in oklch, ${color} 20%, transparent)`, borderColor: color, color }}
      >
        {icon}
      </span>
      <span className="w-full truncate text-center text-xs text-foreground/80">{label}</span>
    </div>
  );
}
