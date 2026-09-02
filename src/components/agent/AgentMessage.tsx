import { clsx } from "clsx";
import { Circle, CircleCheck, CircleX } from "lucide-react";
import { assertNever } from "@/engine";
import type { TranscriptEntry } from "@/agent/types";

const ARGS_PREVIEW_CHARS = 48;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A one-line preview of a tool call's arguments, e.g. `volume_ml: 2, to_id: "c_2"`. */
function previewArgs(input: unknown): string | null {
  if (!isRecord(input)) return null;
  const entries = Object.entries(input);
  if (entries.length === 0) return null;
  const text = entries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(", ");
  return text.length > ARGS_PREVIEW_CHARS ? `${text.slice(0, ARGS_PREVIEW_CHARS)}…` : text;
}

export interface AgentMessageProps {
  readonly entry: TranscriptEntry;
}

/** One row in the agent transcript: a user bubble, plain assistant text, or a compact tool step. */
export function AgentMessage({ entry }: AgentMessageProps) {
  switch (entry.kind) {
    case "user":
      return <UserBubble text={entry.text} />;
    case "assistant":
      return <AssistantText text={entry.text} />;
    case "tool":
      return <ToolStep entry={entry} />;
    default:
      return assertNever(entry);
  }
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-lg bg-surface-thin px-2.5 py-1.5 text-sm text-ink">{text}</p>
    </div>
  );
}

function AssistantText({ text }: { text: string }) {
  return <p className="text-base leading-relaxed text-white">{text}</p>;
}

/** The tool step's second line: the result once it lands, its call args while it is still running. */
function observationFor(entry: Extract<TranscriptEntry, { kind: "tool" }>): string | null {
  if (entry.status === "done" && entry.resultSummary) return entry.resultSummary;
  return previewArgs(entry.input);
}

function ToolStep({ entry }: { entry: Extract<TranscriptEntry, { kind: "tool" }> }) {
  const running = entry.status === "running";
  const observation = observationFor(entry);

  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-hairline px-2 py-1.5">
      <div className="flex items-center gap-2">
        <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", running ? "bg-amber" : entry.ok ? "bg-ok" : "bg-danger")} aria-hidden />
        <span className="shrink-0 font-mono text-xs text-ink">{entry.name}</span>
        <span className="flex-1" />
        <StatusIcon running={running} ok={entry.ok} />
        {entry.durationMs !== undefined ? <span className="tabular-nums text-xs text-ink-3">{entry.durationMs}ms</span> : null}
      </div>
      {observation ? <p className="truncate pl-3.5 text-xs text-white/75">{observation}</p> : null}
    </div>
  );
}

function StatusIcon({ running, ok }: { running: boolean; ok: boolean | undefined }) {
  if (running) return <Circle size={12} className="shrink-0 text-ink-3" />;
  if (ok) return <CircleCheck size={12} className="shrink-0 text-ok" />;
  return <CircleX size={12} className="shrink-0 text-danger" />;
}
