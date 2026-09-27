import { describe, expect, it } from "vitest";
import { fromPiastres, moneyNumber, moneyString, toPiastres } from "./money.js";

describe("money", () => {
  it("round-trips numeric strings through integer piastres", () => {
    expect(toPiastres("1500.00")).toBe(150000);
    expect(fromPiastres(150000)).toBe(1500);
    expect(moneyNumber("2600.5")).toBe(2600.5);
  });

  it("avoids binary floating-point drift", () => {
    expect(toPiastres(0.1) + toPiastres(0.2)).toBe(30);
    expect(moneyString(0.1 + 0.2)).toBe("0.30");
  });

  it("rejects non-numeric input", () => {
    expect(() => toPiastres("abc")).toThrow();
  });
});
