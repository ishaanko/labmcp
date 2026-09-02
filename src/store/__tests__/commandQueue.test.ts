import { describe, expect, it } from "vitest";
import { enqueue, queueDepth } from "../commandQueue";

describe("commandQueue", () => {
  it("runs 50 interleaved jobs in FIFO order", async () => {
    const order: number[] = [];
    const jobs = Array.from({ length: 50 }, (_, i) =>
      enqueue(async () => {
        await Promise.resolve();
        order.push(i);
      }),
    );
    await Promise.all(jobs);
    expect(order).toEqual(Array.from({ length: 50 }, (_, i) => i));
  });

  it("does not stall the queue when a job throws", async () => {
    const results: string[] = [];
    const rejecting = enqueue(() => {
      throw new Error("boom");
    }).catch(() => {
      results.push("caught");
    });
    const following = enqueue(() => {
      results.push("second");
    });
    await Promise.all([rejecting, following]);
    expect(results).toEqual(["caught", "second"]);
  });

  it("reports zero depth once every job has settled", async () => {
    expect(queueDepth()).toBe(0);
    const running = enqueue(async () => {
      expect(queueDepth()).toBeGreaterThan(0);
    });
    await running;
    expect(queueDepth()).toBe(0);
  });
});
