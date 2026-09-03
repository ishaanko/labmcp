import type { ReactNode } from "react";

/** Every dock icon takes the same two props: a pixel size and a passthrough class. */
export interface IconProps {
  readonly size?: number;
  readonly className?: string;
}

/** Icons render at 30px inside the 56px `TileGlyph` square (see `Tile.tsx`). */
export const ICON_SIZE = 30;
const STROKE = 2;

interface SvgProps extends IconProps {
  readonly children: ReactNode;
}

/** Shared `<svg>` shell: 24x24 viewBox, 2px round-joined `currentColor` strokes, nothing filled by default. */
export function Svg({ size = ICON_SIZE, className, children }: SvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/**
 * The reagent-bottle body shared by most solutions: a neck, sloped shoulders, a flat-bottomed
 * body. Left as an open path on purpose — the cap line closes it, so an SVG fill auto-closes the
 * gap with the same straight segment. `heavy`  widens the base for reagents that want to look
 * denser on the shelf (barium chloride).
 */
export const BOTTLE_BODY = "M10 3v3.4L6.5 10.6A3 3 0 0 0 6 12.4V19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6.6a3 3 0 0 0-.5-1.8L14 6.4V3Z";
export const BOTTLE_BODY_HEAVY =
  "M10 3v3.4L6.5 10.6A4 4 0 0 0 5.5 13.2V18a3 3 0 0 0 3 3h7a3 3 0 0 0 3-3v-4.8a4 4 0 0 0-1-2.6L14 6.4V3Z";

/** Bottle silhouette: cap, body (28%-fill sticker by default), label band. `dark` makes an amber-glass bottle instead. */
export function BottleOutline({ bodyD = BOTTLE_BODY, dark = false }: { readonly bodyD?: string; readonly dark?: boolean }) {
  return (
    <>
      <path d="M10 3h4" />
      <path d={bodyD} fill="currentColor" fillOpacity={dark ? 0.85 : 0.28} />
      <path d="M6.5 15h11" />
    </>
  );
}
