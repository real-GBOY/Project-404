import { describe, expect, it } from "vitest";
import { RenderQueue } from "./render-queue.js";

const gate = () => {
  let open!: () => void;
  const p = new Promise<void>((r) => (open = r));
  return { p, open };
};
const tick = () => new Promise((r) => setTimeout(r, 5));

describe("RenderQueue", () => {
  it("never runs more than the concurrency at once and drains the waiting jobs in order", async () => {
    const q = new RenderQueue({ concurrency: 2, maxQueue: 10, timeoutMs: 5_000 });
    let running = 0;
    let peak = 0;
    const order: number[] = [];
    const gates = Array.from({ length: 5 }, gate);
    const jobs = gates.map((g, i) =>
      q.run(async () => {
        running += 1;
        peak = Math.max(peak, running);
        order.push(i);
        await g.p;
        running -= 1;
        return i;
      }),
    );
    await tick();
    expect(q.stats()).toMatchObject({ active: 2, waiting: 3 });
    gates.forEach((g) => g.open());
    expect(await Promise.all(jobs)).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
    expect(order).toEqual([0, 1, 2, 3, 4]);
    expect(q.stats()).toMatchObject({ active: 0, waiting: 0, completed: 5 });
  });

  it("turns away work beyond the queue limit with a retry hint instead of piling up", async () => {
    const q = new RenderQueue({ concurrency: 1, maxQueue: 1, timeoutMs: 5_000 });
    const g = gate();
    const a = q.run(() => g.p);
    const b = q.run(() => g.p);
    await tick();
    await expect(q.run(async () => 1)).rejects.toMatchObject({ code: "raqib.pdf_busy", kind: "rate_limited" });
    expect(q.stats().rejected).toBe(1);
    g.open();
    await Promise.all([a, b]);
  });

  it("abandons a job that overruns, tells the owner, and keeps serving", async () => {
    const q = new RenderQueue({ concurrency: 1, maxQueue: 5, timeoutMs: 30 });
    let cleaned = false;
    await expect(
      q.run(
        () => new Promise(() => undefined),
        () => (cleaned = true),
      ),
    ).rejects.toMatchObject({ code: "raqib.pdf_timeout" });
    expect(cleaned).toBe(true);
    expect(await q.run(async () => "next")).toBe("next");
    expect(q.stats()).toMatchObject({ timedOut: 1, active: 0 });
  });

  it("frees its slot when a job fails", async () => {
    const q = new RenderQueue({ concurrency: 1, maxQueue: 5, timeoutMs: 5_000 });
    await expect(q.run(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(await q.run(async () => 1)).toBe(1);
    expect(q.stats()).toMatchObject({ failed: 1, completed: 1, active: 0 });
  });
});
