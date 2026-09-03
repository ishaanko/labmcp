import type { ReactNode } from "react";
import { BOTTLE_BODY_HEAVY, BottleOutline, Svg, type IconProps } from "./base";

/** Water: a droplet with a highlight streak. Also the fallback shape wherever a reagent has no dedicated icon. */
export function WaterIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M12 3c3.2 4.2 6 8 6 11.2A6 6 0 0 1 6 14.2C6 11 8.8 7.2 12 3Z" fill="currentColor" fillOpacity={0.28} />
      <path d="M9.2 13.2c.2-1.7 1.3-3 2.6-3.6" />
    </Svg>
  );
}

/** Generic reagent bottle, used as the exhaustive-switch fallback when a reagent id has no dedicated pictogram. */
export function BottleIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <BottleOutline />
    </Svg>
  );
}

/** HCl: a bottle, a drop falling off the shoulder, and a small "+" for the H+ it donates. */
export function HclIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <BottleOutline />
      <path d="M18.6 16.6c1 1.3 1.4 2.1 1.4 2.8a1.4 1.4 0 1 1-2.8 0c0-.7.4-1.5 1.4-2.8Z" fill="currentColor" stroke="none" />
      <path d="M13.9 12.4h2.6M15.2 11.1v2.6" strokeWidth={1} />
    </Svg>
  );
}

/** NaOH: a bottle with three solid pellets settled at the bottom. */
export function NaohIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <BottleOutline />
      <circle cx={9} cy={18} r={1} fill="currentColor" stroke="none" />
      <circle cx={12} cy={19} r={1} fill="currentColor" stroke="none" />
      <circle cx={15} cy={18} r={1} fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Acetic acid: a narrow-necked vinegar bottle with a leaf-shaped label instead of the plain band. */
export function AceticAcidIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M11 2h2" />
      <path
        d="M11 2v4.5L8 9.2A3.3 3.3 0 0 0 6.6 12v6.3A2.7 2.7 0 0 0 9.3 21h5.4a2.7 2.7 0 0 0 2.7-2.7V12A3.3 3.3 0 0 0 16 9.2L13 6.5V2Z"
        fill="currentColor"
        fillOpacity={0.28}
      />
      <path d="M9.1 15.2c1.4-2.3 4.4-2.3 5.8 0-1.4 2.3-4.4 2.3-5.8 0Z" fill="currentColor" fillOpacity={0.65} stroke="none" />
      <path d="M9.4 15.2h5.2" strokeWidth={0.6} />
    </Svg>
  );
}

/** Ammonia: a bottle with two wisps rising from the neck. */
export function AmmoniaIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <BottleOutline />
      <path d="M9.6 3c-.6-.7-.7-1.5-.2-2.3" />
      <path d="M13.6 3c.5-.8.4-1.6-.2-2.4" />
    </Svg>
  );
}

/** NaCl: a salt shaker, a domed perforated cap over a jar body, distinct from the bottle silhouette. */
export function NaclIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M7.5 7.5h9v11a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2Z" fill="currentColor" fillOpacity={0.28} />
      <path d="M7.5 7.5a4.5 3.6 0 0 1 9 0Z" fill="currentColor" fillOpacity={0.55} />
      <path d="M7.5 10h9" strokeWidth={1.2} />
      <circle cx={10.2} cy={5.6} r={0.65} fill="#000" fillOpacity={0.6} stroke="none" />
      <circle cx={12} cy={5} r={0.65} fill="#000" fillOpacity={0.6} stroke="none" />
      <circle cx={13.8} cy={5.6} r={0.65} fill="#000" fillOpacity={0.6} stroke="none" />
    </Svg>
  );
}

/** AgNO3: an amber-glass bottle (mostly filled) with a crescent glint and two sparkle ticks. */
export function Agno3Icon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <BottleOutline dark />
      <path
        d="M14 9.4 14.5 11.5 16.6 12 14.5 12.5 14 14.6 13.5 12.5 11.4 12 13.5 11.5Z"
        fill="#fff"
        fillOpacity={0.9}
        stroke="none"
      />
    </Svg>
  );
}

/** CaCl2: a bottle with a snowflake asterisk and two flake chips, the road-salt cue. */
export function Cacl2Icon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <BottleOutline />
      <g fill="currentColor" stroke="none">
        <rect x={-1.9} y={-0.4} width={3.8} height={0.8} transform="translate(12 10.6)" />
        <rect x={-1.9} y={-0.4} width={3.8} height={0.8} transform="translate(12 10.6) rotate(60)" />
        <rect x={-1.9} y={-0.4} width={3.8} height={0.8} transform="translate(12 10.6) rotate(120)" />
        <path d="M9.4 16 10.5 17.2 9.4 18.4 8.3 17.2Z" />
        <path d="M14.6 16.4 15.6 17.5 14.6 18.6 13.6 17.5Z" />
      </g>
    </Svg>
  );
}

/** BaCl2: the standard bottle with a heavier, wider base, since barium is the heavy one on the shelf. */
export function Bacl2Icon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <BottleOutline bodyD={BOTTLE_BODY_HEAVY} />
    </Svg>
  );
}

/** Na2SO4: a bottle with a cut-diamond crystal on the label. */
export function Na2so4Icon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <BottleOutline />
      <path d="M12 8.8 14.1 11.3 12 13.8 9.9 11.3Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Na2CO3: a bottle with bubbles rising, since it fizzes with acid. */
export function Na2co3Icon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <BottleOutline />
      <g fill="none" strokeWidth={1}>
        <circle cx={12} cy={18.6} r={0.9} />
        <circle cx={10.2} cy={16.2} r={0.7} />
        <circle cx={13.5} cy={12} r={0.55} />
      </g>
    </Svg>
  );
}

/** NaHCO3: a baking-soda box, lid flap open, with a scoop spoon resting on the corner. */
export function Nahco3Icon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M5.3 8.2 6.8 5h10.4l1.5 3.2Z" fill="currentColor" fillOpacity={0.45} strokeWidth={1.5} />
      <path d="M6 8.2h12v11a1.3 1.3 0 0 1-1.3 1.3H7.3A1.3 1.3 0 0 1 6 19.2Z" fill="currentColor" fillOpacity={0.28} />
      <path d="M8.5 14.5h6" strokeWidth={1.4} />
      <ellipse cx={15.8} cy={14.5} rx={1.7} ry={1.15} fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** CuSO4: two jagged crystal spikes clustered together, the shape of a mineral sample rather than a bottle. */
export function Cuso4Icon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M9 4.5 11 8l-1 8.5-3-2-1-6.5Z" fill="currentColor" fillOpacity={0.28} />
      <path d="M14.5 6 17 8.3l-1 7.7-3-1.5-1-5.8Z" fill="currentColor" fillOpacity={0.28} />
    </Svg>
  );
}

/** KNO3: a crystal pile, filled this time (bolder than a plain outline) for a solid reagent dosed by mass. */
export function Kno3Icon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M8 5.5 11 3l3 2.5-1 5.5H9L8 5.5Z" fill="currentColor" fillOpacity={0.28} />
      <path d="M4.5 13 8 11l1 5-2.5 3.5-3-2L4.5 13Z" fill="currentColor" fillOpacity={0.28} />
      <path d="M13 11.5l3.5-1.5 3 2.5-1 4-4 1.5-2.5-3 1-3.5Z" fill="currentColor" fillOpacity={0.28} />
    </Svg>
  );
}

/** Unknown sample: a bottle with a question mark where the label would name it. */
export function UnknownReagentIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <BottleOutline />
      <path d="M10.4 10a1.7 1.7 0 1 1 2.8 1.3c-.7.6-1.2 1-1.2 2" />
      <circle cx={12} cy={16.3} r={0.9} fill="currentColor" stroke="none" />
    </Svg>
  );
}

/**
 * Reagent id (or `"water"`/`"kno3"`/etc.) to its dock pictogram. Ids come from the shelf registry
 * (`reagentDef`), except the four `unknown_*` mystery samples, which are not registered and are
 * matched by prefix instead.
 */
export function reagentIcon(id: string, size?: number, className?: string): ReactNode {
  if (id.startsWith("unknown_")) return <UnknownReagentIcon size={size} className={className} />;
  switch (id) {
    case "water":
      return <WaterIcon size={size} className={className} />;
    case "hcl":
      return <HclIcon size={size} className={className} />;
    case "naoh":
      return <NaohIcon size={size} className={className} />;
    case "acetic_acid":
      return <AceticAcidIcon size={size} className={className} />;
    case "ammonia":
      return <AmmoniaIcon size={size} className={className} />;
    case "nacl":
      return <NaclIcon size={size} className={className} />;
    case "agno3":
      return <Agno3Icon size={size} className={className} />;
    case "cacl2":
      return <Cacl2Icon size={size} className={className} />;
    case "bacl2":
      return <Bacl2Icon size={size} className={className} />;
    case "na2so4":
      return <Na2so4Icon size={size} className={className} />;
    case "na2co3":
      return <Na2co3Icon size={size} className={className} />;
    case "nahco3":
      return <Nahco3Icon size={size} className={className} />;
    case "cuso4":
      return <Cuso4Icon size={size} className={className} />;
    case "kno3":
      return <Kno3Icon size={size} className={className} />;
    default:
      return <BottleIcon size={size} className={className} />;
  }
}
