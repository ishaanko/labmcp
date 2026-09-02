import { describe, expect, it, vi } from "vitest";

vi.mock("@/engine", () => {
  const assertNever = (x: never): never => {
    throw new Error(`unexpected: ${JSON.stringify(x)}`);
  };
  return { assertNever, describeEvent: (e: { kind: string }) => `desc:${e.kind}` };
});

import {
  describeCommand,
  eventsToMeasurements,
  eventsToToasts,
  summarizeEvents,
  targetOfCommand,
  type ToastMessage,
} from "../../lib/events";

function lab(objects: ReadonlyArray<{ id: string; kind: string; label?: string; type?: string }> = []) {
  return { objects } as unknown as Parameters<typeof describeCommand>[1];
}

const obs = (event: object) => ({ seq: 1, clockS: 0, actor: "human" as const, event }) as never;

describe("describeCommand", () => {
  it("names containers by label for a transfer", () => {
    const l = lab([
      { id: "c_1", kind: "container", label: "Flask A" },
      { id: "c_2", kind: "container", label: "Beaker B" },
    ]);
    const line = describeCommand({ kind: "TRANSFER_LIQUID", fromId: "c_1" as never, toId: "c_2" as never, volumeMl: 25 }, l);
    expect(line).toBe("Poured 25 mL Flask A -> Beaker B");
  });

  it("falls back to the raw id for an unknown container", () => {
    const line = describeCommand({ kind: "STIR", containerId: "c_9" as never }, lab());
    expect(line).toContain("c_9");
  });
});

describe("targetOfCommand", () => {
  it("has no target for global commands", () => {
    expect(targetOfCommand({ kind: "RESET" })).toBeUndefined();
    expect(targetOfCommand({ kind: "UNDO" })).toBeUndefined();
  });

  it("targets the destination container for a transfer", () => {
    expect(targetOfCommand({ kind: "TRANSFER_LIQUID", fromId: "c_1" as never, toId: "c_2" as never, volumeMl: 5 })).toBe("c_2");
  });
});

describe("summarizeEvents", () => {
  it("joins describeEvent lines", () => {
    expect(summarizeEvents([obs({ kind: "STIR_STARTED" }), obs({ kind: "SOLIDS_SETTLED" })])).toBe(
      "desc:STIR_STARTED desc:SOLIDS_SETTLED",
    );
  });

  it("has a fallback line for an empty batch", () => {
    expect(summarizeEvents([])).toBe("Nothing changed.");
  });
});

describe("eventsToToasts", () => {
  it("only surfaces notable event kinds", () => {
    const events = [obs({ kind: "STIR_STARTED" }), obs({ kind: "PRECIPITATE_FORMED" }), obs({ kind: "SOLIDS_SETTLED" })];
    const toasts = eventsToToasts(events, "human");
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.title).toBe("desc:PRECIPITATE_FORMED");
  });

  it("skips a color shift unless it is an indicator transition", () => {
    const quiet = eventsToToasts([obs({ kind: "COLOR_SHIFT", indicatorTransition: false })], "human");
    const loud = eventsToToasts([obs({ kind: "COLOR_SHIFT", indicatorTransition: true })], "human");
    expect(quiet).toHaveLength(0);
    expect(loud).toHaveLength(1);
  });

  it("marks rejections as error toasts", () => {
    const toasts: ReadonlyArray<ToastMessage> = eventsToToasts([obs({ kind: "OVERFLOW_REJECTED" })], "agent");
    expect(toasts[0]?.kind).toBe("error");
  });
});

describe("eventsToMeasurements", () => {
  it("maps each reading kind to a labeled row", () => {
    const rows = eventsToMeasurements(
      [
        obs({ kind: "MEASUREMENT", containerId: "c_1", reading: { kind: "ph", value: 7.2 } }),
        obs({ kind: "MEASUREMENT", containerId: "c_1", reading: { kind: "temperature", valueC: 25 } }),
        obs({ kind: "MEASUREMENT", containerId: "c_1", reading: { kind: "volume", valueMl: 40 } }),
        obs({ kind: "STIR_STARTED" }),
      ],
      "agent",
    );
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.label)).toEqual(["pH", "Temperature", "Volume"]);
    expect(rows.every((r) => r.source === "agent" && r.kind === "measurement")).toBe(true);
  });
});
