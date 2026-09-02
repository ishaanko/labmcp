import { publicView, type Actor, type LabState } from "@/engine";
import { groupCommandBatches, mergeObservationLines, plainLabels } from "./summary";
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

/**
 * Append-only lab notebook, one row per command (deliverable 5 of the copy rules: "Dispensed 0.5
 * mL into Flask A. pH 3.00 to 7.00." reads as one line, not four). `groupCommandBatches` recovers
 * command boundaries from the flat, per-event `lab.observations` log; UNDO never rewrites past rows.
 * Labels never carry an id here, unlike the tool-facing `dr.observation`: a notebook row is read by
 * a human next to the bench, who has never needed to type "c_1" into anything.
 */
export function notebookRows(lab: LabState): ReadonlyArray<NotebookRow> {
  const pub = publicView(lab);
  const labels = plainLabels(pub);
  const rows: NotebookRow[] = [];
  for (const group of groupCommandBatches(lab.observations)) {
    const head = group[0];
    if (!head) continue; // groupCommandBatches never emits an empty group; guard is for the type only.
    rows.push({
      seq: head.seq,
      clockS: round2(head.clockS),
      actor: head.actor,
      kind: rowKindFor(head.event.kind),
      text: mergeObservationLines(
        pub,
        group.map((o) => o.event),
        labels,
      ),
    });
  }
  return rows;
}

/** Feeds get_notebook and the "copy notebook" button. */
export function renderNotebookMarkdown(rows: ReadonlyArray<NotebookRow>): string {
  if (rows.length === 0) return "_No entries yet._";
  return rows.map((r, i) => `${i + 1}. [${r.actor}] ${r.text}`).join("\n");
}
