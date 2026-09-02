import { clsx } from "clsx";
import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

/** CSSProperties plus arbitrary custom properties, so a `--rise` var can be set without a cast. */
type StyleWithVars = CSSProperties & Record<`--${string}`, string | number>;
import type { PrecipitateScale } from "@/engine";
import type { LiquidRect } from "./liquid";
import type { VesselPrecipitate } from "./types";

export const OUTLINE = "rgba(230,230,238,0.9)";
export const OUTLINE_SELECTED = "#ffffff";
export const GLASS_FILL = "rgba(255,255,255,0.06)";
export const OUTLINE_WIDTH = 2.5;
export const OUTLINE_WIDTH_SELECTED = 3;
const MENISCUS = "rgba(255,255,255,0.55)";

/** Rendered pixel size for a `size`-scaled SVG, preserving its own viewBox aspect ratio. */
export function svgDims(viewBoxWidth: number, viewBoxHeight: number, size: number): { width: number; height: number } {
  return { width: size, height: (size * viewBoxHeight) / viewBoxWidth };
}

interface VesselFrameProps {
  readonly viewBoxWidth: number;
  readonly viewBoxHeight: number;
  readonly size: number;
  /** Caption under the glass; empty hides the caption (a docked instrument's card names it instead). */
  readonly label: string;
  /** True while the pointer is over this vessel, or it is hovered by store state (drag target etc). */
  readonly hovered: boolean;
  readonly selected?: boolean;
  readonly children: ReactNode;
}

/**
 * Shared mount/hover motion for every vessel and instrument: a springy pop on drop, a small hover
 * lift, and the label underneath. Everything else (fill, precipitate, selection) is plain CSS
 * transitions on the SVG children, so it stays cheap while idle.
 *
 * Only painted SVG shapes take pointer events. The figure, svg box, and label fall through, so a
 * tall burette's empty corners never steal a drop aimed at the flask beneath it. Enter/leave
 * still reach the figure because they bubble from the shapes.
 */
export function VesselFrame({ viewBoxWidth, viewBoxHeight, size, label, hovered, selected = false, children }: VesselFrameProps) {
  const { width, height } = svgDims(viewBoxWidth, viewBoxHeight, size);
  return (
    <motion.figure
      className="pointer-events-none inline-flex flex-col items-center gap-1"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: hovered ? 1.02 : 1, y: hovered ? -3 : 0 }}
      whileHover={{ y: -3, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 420, damping: 26, duration: 0.2 }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="overflow-visible">
        <g style={{ pointerEvents: "visiblePainted" }}>{children}</g>
      </svg>
      {label ? <figcaption className={clsx("text-xs", selected ? "font-medium text-ink" : "text-ink-2")}>{label}</figcaption> : null}
    </motion.figure>
  );
}

interface SelectionRingProps {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly selected: boolean;
  readonly agentActive: boolean;
}

/**
 * Halo around a vessel: a thin white ring while it is the selection, a thicker amber one while
 * the agent is acting on it (amber wins). Opacity-only transition, so nothing paints at rest.
 */
export function SelectionRing({ x, y, width, height, selected, agentActive }: SelectionRingProps) {
  return (
    <rect
      x={x - 6}
      y={y - 6}
      width={width + 12}
      height={height + 12}
      rx={16}
      fill="none"
      stroke={agentActive ? "var(--amber)" : "rgba(255,255,255,0.45)"}
      strokeWidth={agentActive ? 3 : 1.5}
      style={{ opacity: agentActive ? 0.8 : selected ? 1 : 0, transition: "opacity 200ms ease-out", pointerEvents: "none" }}
    />
  );
}

interface LiquidBodyProps {
  readonly rect: LiquidRect;
  readonly color: string;
  readonly clipId: string;
}

/** The liquid fill itself: a clipped rect that animates height/y and color on prop change. */
export function LiquidBody({ rect, color, clipId }: LiquidBodyProps) {
  const style: CSSProperties = { transition: "y 360ms cubic-bezier(0.23,1,0.32,1), height 360ms cubic-bezier(0.23,1,0.32,1), fill 400ms" };
  return (
    <g clipPath={`url(#${clipId})`}>
      <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={color} style={style} />
      {rect.height > 0.5 && (
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={2}
          fill={MENISCUS}
          style={{ transition: "y 360ms cubic-bezier(0.23,1,0.32,1)" }}
        />
      )}
    </g>
  );
}

const PRECIPITATE_COUNT: Readonly<Record<PrecipitateScale, number>> = {
  trace: 8,
  small: 13,
  moderate: 19,
  heavy: 24,
};

/** Deterministic pseudo-random offset in [-0.5, 0.5] for speck `i`, so layout never re-jitters. */
function jitter(i: number): number {
  const t = ((i * 2654435761) % 1000) / 1000;
  return t - 0.5;
}

interface PrecipitateBedProps {
  readonly precipitate: VesselPrecipitate;
  readonly left: number;
  readonly right: number;
  readonly floorY: number;
}

/**
 * Solid deposit at the bottom of a vessel: a flat mound on the floor plus specks that spread
 * upward while `suspended` is 1 and settle back onto the mound at 0.
 */
export function PrecipitateBed({ precipitate, left, right, floorY }: PrecipitateBedProps) {
  const count = PRECIPITATE_COUNT[precipitate.scale];
  const width = right - left;
  const spreadPx = 34;
  const moundHeight = 7 + count / 3;
  return (
    <g>
      <path
        d={`M ${left + 4} ${floorY} Q ${(left + right) / 2} ${floorY - moundHeight} ${right - 4} ${floorY} Z`}
        fill={precipitate.color}
        style={{ opacity: 0.9 * (1 - precipitate.suspended), transition: "opacity 600ms ease-out" }}
      />
      {Array.from({ length: count }, (_, i) => {
        const cx = left + width * 0.15 + width * 0.7 * ((i / Math.max(1, count - 1)) + jitter(i) * 0.15);
        const baseCy = floorY - 3 - (Math.abs(jitter(i + 7)) * 6);
        const radius = 2.4 + Math.abs(jitter(i + 3)) * 1.8;
        return (
          <circle
            key={i}
            cx={cx}
            cy={baseCy}
            r={radius}
            fill={precipitate.color}
            style={{
              transform: `translateY(${-precipitate.suspended * spreadPx * (0.4 + Math.abs(jitter(i + 11)))}px)`,
              transition: "transform 600ms ease-out",
            }}
          />
        );
      })}
    </g>
  );
}

interface BubblesProps {
  readonly intensity: number;
  readonly left: number;
  readonly right: number;
  readonly floorY: number;
  readonly ceilingY: number;
}

const BUBBLE_KEYFRAMES = `@keyframes lab2d-bubble-rise { from { transform: translateY(0); opacity: 0.85; } to { transform: translateY(var(--rise, -60px)); opacity: 0; } }`;

/** Rising gas bubbles. Only mounted while `intensity > 0`, so nothing animates at rest. */
export function Bubbles({ intensity, left, right, floorY, ceilingY }: BubblesProps) {
  if (intensity <= 0) return null;
  const width = right - left;
  const rise = floorY - ceilingY;
  const durationS = 1.6 - intensity * 0.6;
  return (
    <g>
      <style>{BUBBLE_KEYFRAMES}</style>
      {Array.from({ length: 6 }, (_, i) => {
        const cx = left + width * (0.2 + 0.6 * (i / 5) + jitter(i) * 0.08);
        const delayS = (i / 6) * durationS;
        const radius = 1.5 + Math.abs(jitter(i + 2)) * 1.2;
        const style: StyleWithVars = { animation: `lab2d-bubble-rise ${durationS}s ease-in ${delayS}s infinite`, "--rise": `${-rise}px` };
        return <circle key={i} cx={cx} cy={floorY - 4} r={radius} fill="rgba(255,255,255,0.55)" style={style} />;
      })}
    </g>
  );
}

interface StirSwirlProps {
  readonly x: number;
  readonly y: number;
}

/** Static three-line swirl glyph shown at the meniscus while a vessel is stirring. */
export function StirSwirl({ x, y }: StirSwirlProps) {
  return (
    <g stroke="rgba(255,255,255,0.75)" strokeWidth={1.5} strokeLinecap="round" fill="none">
      <path d={`M ${x - 10} ${y} q 5 -5 10 0 q 5 5 10 0`} />
      <path d={`M ${x - 7} ${y + 4} q 4 -4 7 0 q 3 4 7 0`} />
      <path d={`M ${x - 4} ${y + 8} q 3 -3 4 0 q 1 3 4 0`} />
    </g>
  );
}
