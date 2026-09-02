import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { clsx } from "clsx";

/** Icon-square fill and rim. Both default from `color` (a 22% fill, a solid rim); equipment overrides them with a neutral face. */
export interface TileFace {
  readonly background?: string;
  readonly borderColor?: string;
}

export interface TileProps extends ButtonHTMLAttributes<HTMLButtonElement>, TileFace {
  readonly color: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly dragging?: boolean;
}

/** Hover/press lift for a dock tile: a 3px rise, well under 250ms, transform only. */
const TILE_LIFT = "transition-transform duration-120 ease-out hover:-translate-y-[3px] active:-translate-y-[1px] active:scale-[0.97]";

export interface TileGlyphProps extends TileFace {
  readonly color: string;
  readonly className?: string;
  readonly children: ReactNode;
}

/** The 56px icon square: a 22%-alpha fill and a 2px rim in the role color, the flat icon centered. Also the drag ghost, on its own. */
export function TileGlyph({ color, background, borderColor, className, children }: TileGlyphProps) {
  return (
    <span
      className={clsx("flex h-14 w-14 items-center justify-center rounded-2xl border-2", className)}
      style={{ background: background ?? `color-mix(in oklch, ${color} 22%, transparent)`, borderColor: borderColor ?? color, color }}
    >
      {children}
    </span>
  );
}

/**
 * Little Alchemy-style dock tile: 80px wide with no side padding, the `TileGlyph` icon square,
 * an 11px caption underneath ("Grad. cylinder" is 77px). Shared by `ReagentChip` and
 * `EquipmentButton`; `ReagentGhost` drags the glyph alone.
 */
export const Tile = forwardRef<HTMLButtonElement, TileProps>(function Tile(
  { color, background, borderColor, label, icon, dragging, className, style, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={clsx(TILE_LIFT, "flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-2xl pt-2 pb-1.5", dragging && "opacity-40", className)}
      style={{ ...style }}
      {...props}
    >
      <TileGlyph color={color} background={background} borderColor={borderColor}>
        {icon}
      </TileGlyph>
      <span className="w-full truncate text-center text-[11px] leading-[13px] font-medium text-white/90">{label}</span>
    </button>
  );
});
