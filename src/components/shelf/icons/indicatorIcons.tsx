import type { ReactNode } from "react";
import type { IndicatorKind } from "@/engine";
import { Svg, type IconProps } from "./base";

/** Eyedropper silhouette shared by the two dropper-based indicators. */
function DropperOutline() {
  return (
    <>
      <path d="M15.5 3.5 20 8l-8.5 8.5-5-5L15.5 3.5Z" fill="currentColor" fillOpacity={0.28} />
      <path d="M9 14 5.8 17.2" />
    </>
  );
}

/** Phenolphthalein: the dropper with a solid pink drop at its tip (colorless below pH 8.2, so the drop is the tell). */
export function PhenolphthaleinIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <DropperOutline />
      <path d="M5.4 16.6c.9 1.2 1.3 2 1.3 2.7a1.3 1.3 0 1 1-2.6 0c0-.7.4-1.5 1.3-2.7Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/**
 * Universal indicator: the dropper over a three-bar strip that reads its whole range at a glance
 * (red through green to violet). The bars keep their own fixed hues rather than the tile's role
 * tint, since the point of this icon is the indicator's rainbow response, not its dock color.
 */
export function UniversalIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <DropperOutline />
      <rect x={4.5} y={19} width={4.3} height={2.6} rx={0.6} fill="#ff6b6b" stroke="none" />
      <rect x={9.4} y={19} width={4.3} height={2.6} rx={0.6} fill="#7ae582" stroke="none" />
      <rect x={14.3} y={19} width={4.3} height={2.6} rx={0.6} fill="#b48cff" stroke="none" />
    </Svg>
  );
}

/** Litmus: two dipped paper strips, red and blue, no dropper (litmus is a strip test, not a titration drop). */
export function LitmusIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x={7} y={3.5} width={4} height={16.5} rx={1.2} fill="#ff6b6b" fillOpacity={0.85} strokeWidth={1.5} />
      <rect x={13} y={6.5} width={4} height={13.5} rx={1.2} fill="#4cc9f0" fillOpacity={0.85} strokeWidth={1.5} />
      <path d="M5.5 15h13" strokeWidth={1.2} />
    </Svg>
  );
}

/** Indicator kind to its dock pictogram. */
export function indicatorIcon(kind: IndicatorKind, size?: number, className?: string): ReactNode {
  switch (kind) {
    case "phenolphthalein":
      return <PhenolphthaleinIcon size={size} className={className} />;
    case "universal":
      return <UniversalIcon size={size} className={className} />;
    case "litmus":
      return <LitmusIcon size={size} className={className} />;
  }
}
