"use client";

import type { ReactNode } from "react";
import { constants, INDICATORS, REAGENT_IDS, UNKNOWN_SAMPLE_SHELF_IDS, reagentDef, type EquipmentType } from "@/engine";
import { iconFor } from "@/components/shelf/icons";
import { EQUIPMENT_LABEL } from "@/components/shelf/EquipmentButton";
import { ROLE_HEX, indicatorRole, reagentRole } from "@/components/shelf/roleColor";

interface Swatch {
  readonly key: string;
  readonly label: string;
  readonly color: string;
  readonly render: (size: number) => ReactNode;
}

const REAGENT_SWATCHES: ReadonlyArray<Swatch> = REAGENT_IDS.map((id) => ({
  key: id,
  label: reagentDef(id)?.label ?? id,
  color: ROLE_HEX[reagentRole(id)],
  render: (size: number) => iconFor("reagent", id, size),
}));

const UNKNOWN_SWATCHES: ReadonlyArray<Swatch> = UNKNOWN_SAMPLE_SHELF_IDS.map((id) => ({
  key: id,
  label: id,
  color: ROLE_HEX[reagentRole(id)],
  render: (size: number) => iconFor("reagent", id, size),
}));

const INDICATOR_SWATCHES: ReadonlyArray<Swatch> = INDICATORS.map((def) => ({
  key: def.id,
  label: def.label,
  color: ROLE_HEX[indicatorRole(def.kind)],
  render: (size: number) => iconFor("indicator", def.kind, size),
}));

const EQUIPMENT_SWATCHES: ReadonlyArray<Swatch> = constants.EQUIPMENT_TYPES.map((type: EquipmentType) => ({
  key: type,
  label: EQUIPMENT_LABEL[type],
  color: "#ffffff",
  render: (size: number) => iconFor("equipment", type, size),
}));

/** One swatch: the icon at 30px (dock size) and 60px (2x, to catch stray strokes), plus its label and id. */
function IconCard({ swatch }: { swatch: Swatch }) {
  return (
    <div className="flex w-32 flex-col items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-end gap-3" style={{ color: swatch.color }}>
        <span className="flex h-14 w-14 items-center justify-center">{swatch.render(30)}</span>
        <span className="flex h-14 w-14 items-center justify-center">{swatch.render(60)}</span>
      </div>
      <span className="text-center text-[11px] leading-tight text-white/80">{swatch.label}</span>
      <span className="font-mono text-[10px] text-white/40">{swatch.key}</span>
    </div>
  );
}

function Section({ title, swatches }: { title: string; swatches: ReadonlyArray<Swatch> }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs tracking-wide text-white/50 uppercase">{title}</h2>
      <div className="flex flex-wrap gap-3">
        {swatches.map((s) => (
          <IconCard key={s.key} swatch={s} />
        ))}
      </div>
    </section>
  );
}

/** Dev-only icon gallery: every dock pictogram at 30px (dock size) and 60px, on black, labeled. */
export default function IconGalleryPage() {
  return (
    <div className="min-h-screen bg-black px-8 py-10 text-white">
      <h1 className="mb-8 text-lg font-medium">Dock icon gallery</h1>
      <div className="flex flex-col gap-10">
        <Section title="Reagents" swatches={REAGENT_SWATCHES} />
        <Section title="Unknown samples" swatches={UNKNOWN_SWATCHES} />
        <Section title="Indicators" swatches={INDICATOR_SWATCHES} />
        <Section title="Equipment" swatches={EQUIPMENT_SWATCHES} />
      </div>
    </div>
  );
}
