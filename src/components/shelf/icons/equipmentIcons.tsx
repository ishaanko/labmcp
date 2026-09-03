import type { ReactNode } from "react";
import { assertNever, type EquipmentType } from "@/engine";
import { Svg, type IconProps } from "./base";

/** Beaker: a cup that flares outward toward its flat base, with a pour lip and two measurement ticks — the opposite taper from the flask's cone. */
export function BeakerIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M15.3 5.2 17 3.8" />
      <path
        d="M7.6 5.2H16.4L17.4 17.8A1.8 1.8 0 0 1 15.6 19.8H8.4A1.8 1.8 0 0 1 6.6 17.8Z"
        fill="currentColor"
        fillOpacity={0.28}
      />
      <path d="M8.6 10.2h1.4M8.9 14h1.4" strokeWidth={1} />
    </Svg>
  );
}

/** Flask: an Erlenmeyer cone, narrow neck flaring to a flat base. */
export function FlaskIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M10 4h4" />
      <path
        d="M10.5 4v4L6.6 17.2A1.7 1.7 0 0 0 8.2 19.6h7.6a1.7 1.7 0 0 0 1.6-2.4L13.5 8V4Z"
        fill="currentColor"
        fillOpacity={0.28}
      />
    </Svg>
  );
}

/** Test tube: a narrow rounded-bottom tube with an open rim. */
export function TestTubeIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M8.7 3h6.6" />
      <path d="M9.2 3v14a2.8 2.8 0 0 0 5.6 0V3Z" fill="currentColor" fillOpacity={0.28} />
    </Svg>
  );
}

/** Graduated cylinder: a straight cylinder on a small foot, with side ticks. */
export function GraduatedCylinderIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M8.7 3h6.6v15.5a1 1 0 0 1-1 1h-4.6a1 1 0 0 1-1-1V3Z" fill="currentColor" fillOpacity={0.28} />
      <path d="M7.5 20.5h9" />
      <path d="M9 8h1.6M9 11.5h1.6M9 15h1.6" strokeWidth={1} />
    </Svg>
  );
}

/** Burette on a stand: a thin stopcock tube clamped to a pole with a foot. */
export function BuretteIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M6 21h6" strokeWidth={1.5} />
      <path d="M8.5 21V4.5" strokeWidth={1.5} />
      <path d="M8.5 10.5h4.5" strokeWidth={1.5} />
      <path d="M13 3h3" />
      <path d="M13.5 3v12.5a1.5 1.5 0 0 0 3 0V3Z" fill="currentColor" fillOpacity={0.28} />
      <path d="M16.7 13.8h1.3" strokeWidth={1} />
      <path d="M15 17.3v1.7" strokeWidth={1.4} />
      <circle cx={15} cy={19.6} r={0.55} fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** pH meter: a handheld body with a readout screen and a probe dipping out the bottom. */
export function PhMeterIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M7.5 3h9a1.6 1.6 0 0 1 1.6 1.6v10.8a1.6 1.6 0 0 1-1.6 1.6h-9a1.6 1.6 0 0 1-1.6-1.6V4.6A1.6 1.6 0 0 1 7.5 3Z" fill="currentColor" fillOpacity={0.28} />
      <path d="M8.6 5.6h6.8v4.2H8.6Z" />
      <circle cx={9.6} cy={13.6} r={0.6} fill="currentColor" stroke="none" />
      <circle cx={12} cy={13.6} r={0.6} fill="currentColor" stroke="none" />
      <path d="M8.8 17 5.2 21.4" />
      <circle cx={5} cy={21.6} r={0.9} fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Thermometer: a bulb-and-column tube, half filled. */
export function ThermometerIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M10.4 3.6a1.6 1.6 0 0 1 3.2 0v10.6a3.2 3.2 0 1 1-3.2 0Z" fill="currentColor" fillOpacity={0.28} />
      <path d="M12 9v7" strokeWidth={2.2} />
      <circle cx={12} cy={17} r={1.8} fill="currentColor" stroke="none" />
      <path d="M15.8 7h1.2M15.8 10h1.2" strokeWidth={1.4} />
    </Svg>
  );
}

/** Hotplate: a low slab with two concentric coil rings and a control knob. */
export function HotplateIcon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M3 13h18v4a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17Z" fill="currentColor" fillOpacity={0.28} />
      <ellipse cx={12} cy={9.8} rx={6.4} ry={2.6} strokeWidth={1.5} />
      <ellipse cx={12} cy={9.8} rx={3.2} ry={1.3} strokeWidth={1.5} />
      <circle cx={5.6} cy={15.2} r={0.9} fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Equipment type to its dock pictogram, matching the flat style of the bench glassware. */
export function equipmentIcon(type: EquipmentType, size?: number, className?: string): ReactNode {
  switch (type) {
    case "beaker":
      return <BeakerIcon size={size} className={className} />;
    case "flask":
      return <FlaskIcon size={size} className={className} />;
    case "test_tube":
      return <TestTubeIcon size={size} className={className} />;
    case "graduated_cylinder":
      return <GraduatedCylinderIcon size={size} className={className} />;
    case "burette":
      return <BuretteIcon size={size} className={className} />;
    case "ph_meter":
      return <PhMeterIcon size={size} className={className} />;
    case "thermometer":
      return <ThermometerIcon size={size} className={className} />;
    case "hotplate":
      return <HotplateIcon size={size} className={className} />;
    default:
      return assertNever(type);
  }
}
