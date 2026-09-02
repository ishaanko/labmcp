/** Flat, thick-outlined glyphs for the reagent dock, drawn inline so each tile stays a single tag. */
export interface TileIconProps {
  readonly size?: number;
  readonly className?: string;
}

const STROKE = 2;

/** Water: a single droplet. Used for the water reagent and as the fallback for an unknown role. */
export function DropletIcon({ size = 28, className }: TileIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" aria-hidden>
      <path
        d="M12 3c3.2 4.2 6 8 6 11.2A6 6 0 0 1 6 14.2C6 11 8.8 7.2 12 3Z"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Solution: a reagent bottle. Used for every acid/base/salt/carbonate stock. */
export function BottleIcon({ size = 28, className }: TileIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" aria-hidden>
      <path d="M10 3h4" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
      <path d="M10 3v3.4L6.5 10.6A3 3 0 0 0 6 12.4V19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6.6a3 3 0 0 0-.5-1.8L14 6.4V3" stroke="currentColor" strokeWidth={STROKE} strokeLinejoin="round" />
      <path d="M6.5 15h11" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
    </svg>
  );
}

/** Solid: a crystal pile. Used for reagents dosed by mass instead of volume, such as KNO3. */
export function CrystalIcon({ size = 28, className }: TileIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" aria-hidden>
      <path d="M8 5.5 11 3l3 2.5-1 5.5H9L8 5.5Z" stroke="currentColor" strokeWidth={STROKE} strokeLinejoin="round" />
      <path d="M4.5 13 8 11l1 5-2.5 3.5-3-2L4.5 13Z" stroke="currentColor" strokeWidth={STROKE} strokeLinejoin="round" />
      <path d="M13 11.5l3.5-1.5 3 2.5-1 4-4 1.5-2.5-3 1-3.5Z" stroke="currentColor" strokeWidth={STROKE} strokeLinejoin="round" />
    </svg>
  );
}

/** Indicator: an eyedropper. Used for phenolphthalein, universal, and litmus. */
export function DropperIcon({ size = 28, className }: TileIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" aria-hidden>
      <path d="M15.5 3.5 20 8l-8.5 8.5-5-5L15.5 3.5Z" stroke="currentColor" strokeWidth={STROKE} strokeLinejoin="round" />
      <path d="M9 14 4.5 18.5" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
      <path d="M4 21l1.5-3" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
    </svg>
  );
}
