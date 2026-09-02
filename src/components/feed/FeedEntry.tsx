"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { motion } from "motion/react";
import { assertNever } from "@/engine";
import { useLabStore } from "@/store/labStore";
import type { FeedEntry as FeedEntryData } from "@/store/types";

/**
 * `lib/events.ts`'s `describeCommand`/`describeEvent` text carries a raw id on an object's
 * first mention, e.g. "Flask A (c_1)": useful for an agent's own follow-up tool calls, wrong
 * for a human-facing feed row. The feed shows the same observation string the agent got, so
 * this strips the "(c_1)"/"(i_2)" suffix here rather than re-rendering the sentence with
 * `lib/labels.ts`'s `plainLabels`.
 */
function stripRawIds(text: string): string {
  return text.replace(/ \((?:c|i)_\d+\)/g, "");
}

export interface FeedEntryProps {
  entry: FeedEntryData;
}

/**
 * One row in the activity feed (C6 item 3): a 6px role dot (amber agent, white human, dim
 * system) and a single truncated line, dense like a log. The full text sits in the row's
 * `title` for a hover tooltip, so nothing is lost to the truncation. Agent rows enter with a
 * 200ms opacity+transform fade; human rows (one per D-key dispense, far more frequent) render
 * immediately, since a per-row FLIP would run a main-thread layout pass over up to 300 rows
 * every keystroke.
 */
export function FeedEntry({ entry }: FeedEntryProps) {
  switch (entry.kind) {
    case "tool_call":
      return <ToolCallRow entry={entry} />;
    case "action":
      return <ActionRow entry={entry} />;
    case "measurement":
      return <MeasurementRow entry={entry} />;
    case "note":
      return <NoteRow entry={entry} />;
    default:
      return assertNever(entry);
  }
}

const DOT_COLOR: Readonly<Record<"agent" | "human" | "system", string>> = {
  agent: "bg-amber",
  human: "bg-white/70",
  system: "bg-ink-3",
};

function Row({ accent, title, children }: { accent: "agent" | "human" | "system"; title: string; children: ReactNode }) {
  return (
    <motion.li
      initial={accent === "agent" ? { opacity: 0, transform: "translateY(-4px)" } : false}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      title={title}
      className="flex items-center gap-2 py-1 pl-1 text-sm"
    >
      <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", DOT_COLOR[accent])} aria-hidden />
      <p className="min-w-0 flex-1 truncate">{children}</p>
    </motion.li>
  );
}

/** The target object's short label, e.g. "Flask" or "pH meter", for the tool call's title line. */
function useTargetLabel(targetId: string | undefined): string | null {
  return useLabStore((s) => {
    if (!targetId) return null;
    const obj = s.lab.objects.find((o) => o.id === targetId);
    if (!obj) return null;
    return obj.kind === "container" ? obj.label : obj.type.replace("_", " ");
  });
}

/** Human-facing title per tool: a fixed string for tools without a target, else built from the target's short label. */
const TOOL_TITLE: Readonly<Record<string, string | ((target: string) => string)>> = {
  dispense: (t) => `Dispense into ${t}`,
  measure_ph: (t) => `Measure pH of ${t}`,
  measure_temperature: (t) => `Measure temperature of ${t}`,
  measure_volume: (t) => `Measure volume of ${t}`,
  add_indicator: (t) => `Add indicator to ${t}`,
  add_reagent: (t) => `Add reagent to ${t}`,
  transfer: (t) => `Transfer into ${t}`,
  stir: (t) => `Stir ${t}`,
  heat: (t) => `Heat ${t}`,
  cool: (t) => `Cool ${t}`,
  inspect_contents: (t) => `Inspect ${t}`,
  add_container: "Add container",
  get_lab_state: "Read lab state",
  load_scenario: "Load scenario",
};

/** Title for a tool call row; unmapped tools (or a mapped one whose target is gone) fall back to the tool name as a phrase. */
function titleFor(tool: string, target: string | null): string {
  const mapped = TOOL_TITLE[tool];
  if (typeof mapped === "string") return mapped;
  if (mapped && target) return mapped(target);
  const phrase = tool.replace(/_/g, " ").replace(/\bph\b/, "pH");
  return target ? `${phrase}: ${target}` : phrase;
}

function ToolCallRow({ entry }: { entry: Extract<FeedEntryData, { kind: "tool_call" }> }) {
  const running = entry.status === "running";
  const targetLabel = useTargetLabel(entry.targetId);
  const title = titleFor(entry.tool, targetLabel);
  const observation = running ? "Running…" : entry.resultSummary ? stripRawIds(entry.resultSummary) : "ok";
  const line = `${title} · ${observation}`;

  return (
    <Row accent="agent" title={line}>
      <span className={entry.ok === false && !running ? "text-destructive" : "text-foreground"}>{title}</span>
      <span className="text-muted-foreground"> · {observation}</span>
    </Row>
  );
}

function ActionRow({ entry }: { entry: Extract<FeedEntryData, { kind: "action" }> }) {
  const observation = stripRawIds(entry.observation);
  const line = `${entry.label} · ${observation}`;

  return (
    <Row accent="human" title={line}>
      <span className="text-foreground">{entry.label}</span>
      <span className={entry.ok ? "text-muted-foreground" : "text-destructive"}> · {observation}</span>
    </Row>
  );
}

function MeasurementRow({ entry }: { entry: Extract<FeedEntryData, { kind: "measurement" }> }) {
  const line = `${entry.label}: ${entry.value.toFixed(2)} ${entry.unit}`;
  return (
    <Row accent={entry.source === "agent" ? "agent" : entry.source === "human" ? "human" : "system"} title={line}>
      <span className="text-foreground">{entry.label}: </span>
      <span className="tabular text-foreground">{entry.value.toFixed(2)}</span>
      <span className="text-foreground"> {entry.unit}</span>
    </Row>
  );
}

function NoteRow({ entry }: { entry: Extract<FeedEntryData, { kind: "note" }> }) {
  return (
    <Row accent="system" title={entry.text}>
      <span className="text-muted-foreground">{entry.text}</span>
    </Row>
  );
}
