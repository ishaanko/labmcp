import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { clsx } from "clsx";

export interface TileProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly color: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly dragging?: boolean;
}

/** Hover/press lift for a dock tile: a 3px rise, well under 250ms, transform only. */
const TILE_LIFT = "transition-transform duration-120 ease-out hover:-translate-y-[3px] active:-translate-y-[1px] active:scale-[0.97]";

/**
 * Little Alchemy-style dock tile: 72x72 icon area, rounded-2xl, a 22%-alpha fill and a 2px
 * border in the reagent/equipment's role color, the bold flat icon centered, the label
 * underneath. Shared by `ReagentChip`, `EquipmentButton`, and `ReagentGhost` (the ghost renders
 * the same markup without the `<button>` semantics, since it is a drag clone, not a control).
 */
export const Tile = forwardRef<HTMLButtonElement, TileProps>(function Tile(
  { color, label, icon, dragging, className, style, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={clsx(TILE_LIFT, "flex w-18 shrink-0 flex-col items-center gap-1.5 rounded-2xl px-1 pt-2 pb-1.5", dragging && "opacity-40", className)}
      style={{ ...style }}
      {...props}
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl border-2"
        style={{ background: `color-mix(in oklch, ${color} 22%, transparent)`, borderColor: color, color }}
      >
        {icon}
      </span>
      <span className="w-full truncate text-center text-xs font-medium text-white/90">{label}</span>
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
    <div className={clsx("flex w-18 shrink-0 flex-col items-center gap-1.5 rounded-2xl px-1 pt-2 pb-1.5", className)}>
      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl border-2"
        style={{ background: `color-mix(in oklch, ${color} 22%, transparent)`, borderColor: color, color }}
      >
        {icon}
      </span>
      <span className="w-full truncate text-center text-xs font-medium text-white/90">{label}</span>
    </div>
  );
}
