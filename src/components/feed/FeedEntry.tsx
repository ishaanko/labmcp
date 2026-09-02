"use client";

import { useState, type ReactNode } from "react";
import { Sparkles, Hand, Cog } from "lucide-react";
import { clsx } from "clsx";
import { motion } from "motion/react";
import { assertNever } from "@/engine";
import { useLabStore } from "@/store/labStore";
import type { FeedEntry as FeedEntryData } from "@/store/types";

/** Long enough that a one-line clamp would visibly cut it, so it earns a "more" toggle. */
const LONG_TEXT_CHARS = 88;

export interface FeedEntryProps {
  entry: FeedEntryData;
}

/**
 * One row in the activity feed (C6 item 3). Agent calls carry an amber left rule and
 * Sparkles; human actions a neutral rule and Hand. Read-only agent calls collapse to one
 * grey line. Agent rows enter with a 200ms opacity+transform fade; human rows (one per D-key
 * dispense, far more frequent) render immediately, since a per-row FLIP would run a main-thread
 * layout pass over up to 300 rows every keystroke.
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

function Row({
  accent,
  icon,
  children,
}: {
  accent: "agent" | "human" | "system";
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <motion.li
      initial={accent === "agent" ? { opacity: 0, transform: "translateY(-4px)" } : false}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className={clsx(
        "flex gap-2 border-l-2 py-1.5 pl-2.5 text-sm",
        accent === "agent" ? "border-accent" : accent === "human" ? "border-ink-3" : "border-transparent",
      )}
    >
      <span className="mt-0.5 shrink-0 text-ink-3">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
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

function ToolCallRow({ entry }: { entry: Extract<FeedEntryData, { kind: "tool_call" }> }) {
  const running = entry.status === "running";
  const collapsed = entry.readOnly && !running;
  const targetLabel = useTargetLabel(entry.targetId);

  return (
    <Row accent="agent" icon={<Sparkles size={13} className={running ? "text-ink-3" : "text-accent-ink"} />}>
      {collapsed ? (
        <p className="truncate text-ink-3">
          <span className="font-mono text-2xs">{entry.tool}</span> · {entry.resultSummary ?? "ok"}
        </p>
      ) : (
        <>
          <p className="font-mono text-2xs text-ink-2">
            {entry.tool}
            {targetLabel ? <span className="text-ink-3"> → {targetLabel}</span> : null}
          </p>
          {running ? (
            <p className="mt-0.5 text-ink-3">Running…</p>
          ) : entry.resultSummary ? (
            <SummaryLine text={entry.resultSummary} tone={entry.ok === false ? "text-danger" : "text-ink"} />
          ) : null}
        </>
      )}
    </Row>
  );
}

function ActionRow({ entry }: { entry: Extract<FeedEntryData, { kind: "action" }> }) {
  return (
    <Row accent="human" icon={<Hand size={13} />}>
      <p className="text-ink">{entry.label}</p>
      <SummaryLine text={entry.observation} tone={entry.ok ? "text-ink-3" : "text-danger"} />
    </Row>
  );
}

/**
 * One summary line under a feed entry's title (C2 item 4): clamped to a single line, with a
 * "more" toggle for anything long enough to have been cut off.
 */
function SummaryLine({ text, tone }: { text: string; tone: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > LONG_TEXT_CHARS;

  return (
    <>
      <p className={clsx("mt-0.5", tone, long && !expanded && "line-clamp-1")}>{text}</p>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 text-2xs text-ink-3 hover:text-ink-2 hover:underline"
        >
          {expanded ? "less" : "more"}
        </button>
      ) : null}
    </>
  );
}

function MeasurementRow({ entry }: { entry: Extract<FeedEntryData, { kind: "measurement" }> }) {
  return (
    <Row accent={entry.source === "agent" ? "agent" : entry.source === "human" ? "human" : "system"} icon={<Cog size={13} />}>
      <p className="text-ink">
        {entry.label}: <span className="tabular">{entry.value.toFixed(2)}</span> {entry.unit}
      </p>
    </Row>
  );
}

function NoteRow({ entry }: { entry: Extract<FeedEntryData, { kind: "note" }> }) {
  return (
    <Row accent="system" icon={<Cog size={13} />}>
      <p className="text-ink-3">{entry.text}</p>
    </Row>
  );
}
