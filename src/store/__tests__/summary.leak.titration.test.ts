import { describe, expect, it } from "vitest";
import { applyCommand, loadScenario, type Actor, type Instrument, type LabCommand, type LabState } from "@/engine";
import { eventsToToasts } from "@/lib/events";
import { notebookRows, renderNotebookMarkdown } from "@/lib/notebook";

/**
 * `summary.leak.test.ts` drives `summarizeLab` against a hand-built, mocked `@/engine` (fast, but
 * can't exercise a real neutralization). This file runs the real engine through an actual
 * titration endpoint so the leak check covers the notebook and toast paths end to end, not just
 * their redaction logic in isolation.
 */

function applyOk(state: LabState, command: LabCommand, actor: Actor = "human") {
  const res = applyCommand(state, command, actor);
  if (!res.ok) throw new Error(`applyOk: ${command.kind} rejected: ${JSON.stringify(res.error)}`);
  return res.value;
}

const FORBIDDEN_TERMS = ["Neutralized", "mmol", "H+", "OH-", "Cl-", "Na+"];

describe("summary.leak: titration endpoint", () => {
  it("never leaks neutralization chemistry through the notebook or toasts for the hidden flask", () => {
    const start = loadScenario("titration", 21);
    if (start.scenario.kind !== "titration") throw new Error("unreachable");
    const meter = start.objects.find((o): o is Instrument => o.kind === "instrument" && o.type === "ph_meter");
    if (!meter) throw new Error("unreachable");

    // Attach the pH meter (so the flask's pH is legitimately readable) and dump the whole burette
    // in, well past the equivalence point, to force the neutralization REACTION and its "Neutralized
    // X mmol H+." clause.
    const attached = applyOk(start, { kind: "ATTACH_INSTRUMENT", instrumentId: meter.id, containerId: start.scenario.flaskId });
    const dispensed = applyOk(attached.state, { kind: "DISPENSE", buretteId: start.scenario.buretteId, toId: start.scenario.flaskId, volumeMl: 50 }, "agent");
    const reaction = dispensed.events.find((o) => o.event.kind === "REACTION");
    expect(reaction).toBeDefined();

    const notebook = renderNotebookMarkdown(notebookRows(dispensed.state));
    for (const term of FORBIDDEN_TERMS) expect(notebook).not.toContain(term);

    const toasts = eventsToToasts(dispensed.events, "agent", dispensed.state);
    const toastText = toasts.map((t) => `${t.title} ${t.description ?? ""}`).join(" ");
    for (const term of FORBIDDEN_TERMS) expect(toastText).not.toContain(term);
  });
});
