// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { instrumentDropTarget } from "../objectDom";

/** Mounts a `[data-object-id]` node whose body (first child) reports `rect` from `getBoundingClientRect`. */
function mountContainer(id: string, rect: { left: number; top: number; width: number; height: number }): void {
  const root = document.createElement("div");
  root.setAttribute("data-object-id", id);
  const body = document.createElement("div");
  body.getBoundingClientRect = () =>
    ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => "" }) as DOMRect;
  root.appendChild(body);
  document.body.appendChild(root);
}

describe("instrumentDropTarget", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("matches a point inside a container's own rect", () => {
    mountContainer("a", { left: 0, top: 0, width: 100, height: 100 });
    expect(instrumentDropTarget(50, 50, ["a"], 56, 90)).toBe("a");
  });

  it("matches a point in the inflated margin outside the rect but within the inflate distance", () => {
    mountContainer("a", { left: 0, top: 0, width: 100, height: 100 });
    expect(instrumentDropTarget(140, 50, ["a"], 56, 90)).toBe("a");
    expect(instrumentDropTarget(200, 50, ["a"], 56, 90)).toBeNull();
  });

  it("falls back to the center-radius rule outside the inflated rect", () => {
    mountContainer("a", { left: 0, top: 0, width: 20, height: 20 });
    // Center at (10, 10); 85px away, past the inflated rect (10 + 56 = 66) but inside the 90px center radius.
    expect(instrumentDropTarget(95, 10, ["a"], 56, 90)).toBe("a");
    expect(instrumentDropTarget(200, 10, ["a"], 56, 90)).toBeNull();
  });

  it("picks the nearer center on a tie between two overlapping zones", () => {
    mountContainer("near", { left: 0, top: 0, width: 40, height: 40 });
    mountContainer("far", { left: 80, top: 0, width: 40, height: 40 });
    // (50, 20) is inside both inflated rects (56px margin); "near"'s center (20, 20) is closer than "far"'s (100, 20).
    expect(instrumentDropTarget(50, 20, ["near", "far"], 56, 90)).toBe("near");
  });

  it("returns null when nothing qualifies", () => {
    mountContainer("a", { left: 0, top: 0, width: 100, height: 100 });
    expect(instrumentDropTarget(1000, 1000, ["a"], 56, 90)).toBeNull();
  });

  it("skips container ids that are not mounted", () => {
    expect(instrumentDropTarget(50, 50, ["missing"], 56, 90)).toBeNull();
  });
});
