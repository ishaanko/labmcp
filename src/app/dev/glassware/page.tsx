"use client";

import type { ReactNode } from "react";
import type { ContainerType, InstrumentType } from "@/engine";
import { Instrument, Vessel } from "@/lab2d/glassware/Glassware";
import type { InstrumentProps, VesselProps } from "@/lab2d/glassware/types";

/** Little Alchemy reference colors: acid coral, base sky, carbonate mint, indicator violet. */
const DEMO_COLORS = ["rgba(255,107,107,0.7)", "rgba(76,201,240,0.7)", "rgba(122,229,130,0.7)", "rgba(180,140,255,0.55)"];
const FILL_PERCENTS = [0, 30, 70, 100];

const CAPACITY_ML: Readonly<Record<ContainerType, number>> = {
  beaker: 250,
  flask: 250,
  test_tube: 50,
  graduated_cylinder: 100,
  burette: 50,
};

const VESSEL_LABEL: Readonly<Record<ContainerType, string>> = {
  beaker: "Beaker",
  flask: "Flask",
  test_tube: "Test tube",
  graduated_cylinder: "Cylinder",
  burette: "Burette",
};

function baseVessel(type: ContainerType, pct: number, color: string): VesselProps {
  const capacityMl = CAPACITY_ML[type];
  return {
    type,
    capacityMl,
    volumeMl: (pct / 100) * capacityMl,
    color,
    precipitate: null,
    bubbleIntensity: 0,
    stirring: false,
    heating: false,
    label: `${VESSEL_LABEL[type]} ${pct}%`,
    selected: false,
    hovered: false,
    agentActive: false,
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-hairline pt-4">
      <h2 className="mb-4 text-xs tracking-wide text-ink-2 uppercase">{title}</h2>
      <div className="flex flex-wrap items-end gap-6">{children}</div>
    </section>
  );
}

const VESSEL_TYPES: ReadonlyArray<ContainerType> = ["beaker", "flask", "test_tube", "graduated_cylinder", "burette"];

function FillGrid() {
  return (
    <>
      {VESSEL_TYPES.map((type) => (
        <Section key={type} title={`${VESSEL_LABEL[type]} fill levels`}>
          {FILL_PERCENTS.map((pct, i) => (
            <Vessel key={pct} {...baseVessel(type, pct, DEMO_COLORS[i % DEMO_COLORS.length] ?? "rgba(255,255,255,0.6)")} />
          ))}
        </Section>
      ))}
    </>
  );
}

function PrecipitateRow() {
  const scales = ["trace", "small", "moderate", "heavy"] as const;
  return (
    <>
      <Section title="Precipitate scale (settled)">
        {scales.map((scale) => (
          <Vessel
            key={scale}
            {...baseVessel("beaker", 60, "rgba(76,201,240,0.6)")}
            label={scale}
            precipitate={{ color: "#f4f2ee", scale, suspended: 0 }}
          />
        ))}
      </Section>
      <Section title="Precipitate scale (suspended)">
        {scales.map((scale) => (
          <Vessel
            key={scale}
            {...baseVessel("beaker", 60, "rgba(76,201,240,0.6)")}
            label={scale}
            precipitate={{ color: "#f4f2ee", scale, suspended: 1 }}
            stirring
          />
        ))}
      </Section>
    </>
  );
}

function BubblesAndStirRow() {
  return (
    <Section title="Bubbles and stirring">
      <Vessel {...baseVessel("flask", 55, "rgba(122,229,130,0.6)")} label="at rest" />
      <Vessel {...baseVessel("flask", 55, "rgba(122,229,130,0.6)")} label="bubbling 0.5" bubbleIntensity={0.5} />
      <Vessel {...baseVessel("flask", 55, "rgba(122,229,130,0.6)")} label="bubbling 1.0" bubbleIntensity={1} />
      <Vessel {...baseVessel("beaker", 55, "rgba(180,140,255,0.55)")} label="stirring" stirring />
    </Section>
  );
}

function StateRow() {
  return (
    <Section title="Selection and agent states">
      <Vessel {...baseVessel("beaker", 50, "rgba(255,107,107,0.7)")} label="default" />
      <Vessel {...baseVessel("beaker", 50, "rgba(255,107,107,0.7)")} label="hovered" hovered />
      <Vessel {...baseVessel("beaker", 50, "rgba(255,107,107,0.7)")} label="selected" selected />
      <Vessel {...baseVessel("beaker", 50, "rgba(255,107,107,0.7)")} label="agent active" agentActive />
      <Vessel {...baseVessel("beaker", 50, "rgba(255,107,107,0.7)")} label="selected + agent" selected agentActive />
    </Section>
  );
}

function LowAlphaRow() {
  return (
    <Section title="Alpha floor (engine color under 0.55 still reads on black)">
      <Vessel {...baseVessel("beaker", 80, "rgba(63,143,216,0.05)")} label="alpha 0.05 in" />
      <Vessel {...baseVessel("beaker", 80, "rgba(63,143,216,0.3)")} label="alpha 0.3 in" />
    </Section>
  );
}

function baseInstrument(type: InstrumentType): InstrumentProps {
  return { type, reading: null, attached: false, heatLevel: 0 };
}

function InstrumentsRow() {
  return (
    <>
      <Section title="pH meter">
        <Instrument {...baseInstrument("ph_meter")} reading={null} attached={false} />
        <Instrument {...baseInstrument("ph_meter")} reading="7.20" attached />
        <Instrument {...baseInstrument("ph_meter")} reading="2.85" attached />
      </Section>
      <Section title="Thermometer">
        <Instrument {...baseInstrument("thermometer")} reading="12.0 C" />
        <Instrument {...baseInstrument("thermometer")} reading="55.0 C" />
        <Instrument {...baseInstrument("thermometer")} reading="95.0 C" />
      </Section>
      <Section title="Hotplate">
        <Instrument {...baseInstrument("hotplate")} heatLevel={0} />
        <Instrument {...baseInstrument("hotplate")} heatLevel={0.4} />
        <Instrument {...baseInstrument("hotplate")} heatLevel={1} />
      </Section>
    </>
  );
}

/** Dev-only gallery: every vessel silhouette at every fill level, plus precipitate, bubble, and instrument states. */
export default function GlasswareGalleryPage() {
  return (
    <div className="h-screen overflow-y-auto bg-bg px-8 py-10 text-ink">
      <h1 className="mb-8 text-lg font-medium">Glassware gallery</h1>
      <div className="flex flex-col gap-8">
        <FillGrid />
        <PrecipitateRow />
        <BubblesAndStirRow />
        <StateRow />
        <LowAlphaRow />
        <InstrumentsRow />
      </div>
    </div>
  );
}
