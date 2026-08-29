import { describe, expect, it } from "vitest";
import { fixedClock, systemClock } from "../clock.js";

describe("systemClock", () => {
  it("returns roughly the wall clock", () => {
    expect(Math.abs(systemClock.now().getTime() - Date.now())).toBeLessThan(1000);
  });
});

describe("fixedClock", () => {
  it("starts at the given instant", () => {
    const c = fixedClock("2026-08-29T12:00:00.000Z");
    expect(c.now().toISOString()).toBe("2026-08-29T12:00:00.000Z");
  });

  it("advance moves time forward by the given milliseconds", () => {
    const c = fixedClock("2026-01-01T00:00:00.000Z");
    c.advance(90 * 60 * 1000);
    expect(c.now().toISOString()).toBe("2026-01-01T01:30:00.000Z");
  });

  it("set jumps to an absolute instant", () => {
    const c = fixedClock();
    c.set("2030-06-15T08:00:00.000Z");
    expect(c.now().toISOString()).toBe("2030-06-15T08:00:00.000Z");
  });

  it("hands out a fresh Date each call — a caller cannot mutate its state", () => {
    const c = fixedClock("2026-01-01T00:00:00.000Z");
    const first = c.now();
    first.setFullYear(1999);
    expect(c.now().toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
