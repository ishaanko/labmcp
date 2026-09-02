import { describe, expect, it } from "vitest";
import { GRID } from "../constants";
import { applyCommand } from "../reducer";
import type { LabState } from "../types";
import { applyOk, makeContainer, sandboxState } from "./helpers";

describe("PLACE_OBJECT slot validation", () => {
  it("rejects an explicit off-grid position with SLOT_UNAVAILABLE/out_of_bounds", () => {
    const res = applyCommand(sandboxState(), { kind: "PLACE_OBJECT", objectType: "beaker", position: { x: 100, y: 0 } });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.error).toEqual({ kind: "SLOT_UNAVAILABLE", position: { x: 100, y: 0 }, reason: "out_of_bounds" });
  });

  it("rejects an explicit occupied position with SLOT_UNAVAILABLE/occupied", () => {
    // Sandbox's starter beaker already sits at (-0.5, 0.5) per the C3.2 layout.
    const state = sandboxState();
    const res = applyCommand(state, { kind: "PLACE_OBJECT", objectType: "flask", position: { x: -0.5, y: 0.5 } });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.error).toEqual({ kind: "SLOT_UNAVAILABLE", position: { x: -0.5, y: 0.5 }, reason: "occupied" });
  });

  it("lets a container share a hotplate's cell, but blocks another instrument from it", () => {
    // Sandbox's starter hotplate sits at (1.5, 0.5) per the C3.2 layout.
    const state = sandboxState();
    const withBeaker = applyOk(state, { kind: "PLACE_OBJECT", objectType: "beaker", position: { x: 1.5, y: 0.5 } });
    const shared = withBeaker.objects.find((o) => o.kind === "container" && o.position.x === 1.5 && o.position.y === 0.5);
    expect(shared).toBeDefined();

    const res = applyCommand(state, { kind: "PLACE_OBJECT", objectType: "thermometer", position: { x: 1.5, y: 0.5 } });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.error).toEqual({ kind: "SLOT_UNAVAILABLE", position: { x: 1.5, y: 0.5 }, reason: "occupied" });
  });

  it("rejects an omitted position with SLOT_UNAVAILABLE/bench_full once every cell holds a container", () => {
    const full: LabState = {
      ...sandboxState(),
      objects: Array.from({ length: GRID.cols }, (_, col) =>
        Array.from({ length: GRID.rows }, (_, row) => makeContainer({ position: { x: GRID.minX + col, y: GRID.minY + row } })),
      ).flat(),
    };
    const res = applyCommand(full, { kind: "PLACE_OBJECT", objectType: "beaker" });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.error.kind).toBe("SLOT_UNAVAILABLE");
    if (res.error.kind !== "SLOT_UNAVAILABLE") throw new Error("unreachable");
    expect(res.error.reason).toBe("bench_full");
  });
});
