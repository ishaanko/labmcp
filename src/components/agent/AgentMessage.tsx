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
  return <p className="text-sm leading-relaxed text-ink">{text}</p>;
}

function ToolStep({ entry }: { entry: Extract<TranscriptEntry, { kind: "tool" }> }) {
  const running = entry.status === "running";
  const args = previewArgs(entry.input);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-hairline px-2 py-1.5 text-xs text-ink-2">
      <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", running ? "bg-amber" : entry.ok ? "bg-ok" : "bg-danger")} aria-hidden />
      <span className="shrink-0 font-medium text-ink">{entry.name}</span>
      {args ? <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-3">{args}</span> : <span className="flex-1" />}
      <StatusIcon running={running} ok={entry.ok} />
      {entry.durationMs !== undefined ? <span className="tabular-nums text-ink-3">{entry.durationMs}ms</span> : null}
    </div>
  );
}

function StatusIcon({ running, ok }: { running: boolean; ok: boolean | undefined }) {
  if (running) return <Circle size={12} className="shrink-0 text-ink-3" />;
  if (ok) return <CircleCheck size={12} className="shrink-0 text-ok" />;
  return <CircleX size={12} className="shrink-0 text-danger" />;
}
