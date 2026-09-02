"use client";

import type { ReactNode } from "react";
import { Sparkles, Hand, Cog, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { motion } from "motion/react";
import { assertNever } from "@/engine";
import type { FeedEntry as FeedEntryData } from "@/store/types";

export interface FeedEntryProps {
  entry: FeedEntryData;
}

/**
 * One row in the activity feed (C6 item 3). Agent calls carry an amber left rule and
 * Sparkles; human actions a neutral rule and Hand. Read-only agent calls collapse to one
 * grey line. New rows enter with a 200ms height+opacity transition (handled by the caller's
 * AnimatePresence, this component only renders the row's own content).
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
      layout="position"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
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

function ToolCallRow({ entry }: { entry: Extract<FeedEntryData, { kind: "tool_call" }> }) {
  const running = entry.status === "running";
  const collapsed = entry.readOnly && !running;

  return (
    <Row accent="agent" icon={running ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className="text-accent-ink" />}>
      {collapsed ? (
        <p className="truncate text-ink-3">
          <span className="font-mono text-2xs">{entry.tool}</span> · {entry.resultSummary ?? "ok"}
        </p>
      ) : (
        <>
          <p className="font-mono text-2xs text-ink-2">{entry.tool}</p>
          {!running && entry.resultSummary ? (
            <p className={clsx("mt-0.5", entry.ok === false ? "text-danger" : "text-ink")}>{entry.resultSummary}</p>
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
      <p className={clsx("mt-0.5", entry.ok ? "text-ink-3" : "text-danger")}>{entry.observation}</p>
    </Row>
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
