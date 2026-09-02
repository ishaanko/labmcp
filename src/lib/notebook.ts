import { describeEvent, type Actor, type LabState } from "@/engine";
import { round2 } from "./format";

export type NotebookRowKind = "action" | "measurement" | "observation";

export interface NotebookRow {
  readonly seq: number;
  readonly clockS: number;
  readonly actor: Actor;
  readonly kind: NotebookRowKind;
  readonly text: string;
}

export function rowKindFor(kind: string): NotebookRowKind {
  if (kind === "MEASUREMENT") return "measurement";
  if (kind === "UNDONE") return "action";
  return "observation";
}

/** Append-only lab notebook, one row per engine observation. UNDO never rewrites past rows. */
export function notebookRows(lab: LabState): ReadonlyArray<NotebookRow> {
  return lab.observations.map((o) => ({
    seq: o.seq,
    clockS: round2(o.clockS),
    actor: o.actor,
    kind: rowKindFor(o.event.kind),
    text: describeEvent(o.event),
  }));
}

/** Feeds get_notebook and the "copy notebook" button. */
export function renderNotebookMarkdown(rows: ReadonlyArray<NotebookRow>): string {
  if (rows.length === 0) return "_No entries yet._";
  const lines = rows.map((r) => `- t=${r.clockS}s **${r.actor}** (${r.kind}): ${r.text}`);
  return lines.join("\n");
}
