import { describe, expect, it } from "vitest";
import { applyRegions, regionNames } from "../src/regions.js";

const on = (...names: string[]) => new Set(names);

describe("applyRegions", () => {
  const src = [
    "a",
    "// @auric-begin files",
    "b",
    "// @auric-end files",
    "c",
  ].join("\n");

  it("keeps a selected region and drops its markers", () => {
    expect(applyRegions(src, on("files"))).toBe("a\nb\nc");
  });

  it("drops an unselected region entirely", () => {
    expect(applyRegions(src, on())).toBe("a\nc");
  });

  it("emits the else branch, uncommented, when the module is NOT selected", () => {
    const s = [
      "// @auric-begin notifications",
      "  { verify: true },",
      "// @auric-else notifications",
      "  // { verify: false },",
      "// @auric-end notifications",
    ].join("\n");
    expect(applyRegions(s, on("notifications"))).toBe("  { verify: true },");
    expect(applyRegions(s, on())).toBe("  { verify: false },");
  });

  it("handles nested regions (inner needs both)", () => {
    const s = ["// @auric-begin a", "x", "// @auric-begin b", "y", "// @auric-end b", "// @auric-end a"].join("\n");
    expect(applyRegions(s, on("a", "b"))).toBe("x\ny");
    expect(applyRegions(s, on("a"))).toBe("x");
    expect(applyRegions(s, on("b"))).toBe("");
  });

  it("preserves CRLF line endings", () => {
    expect(applyRegions("a\r\n// @auric-begin x\r\nb\r\n// @auric-end x\r\nc", on("x"))).toBe("a\r\nb\r\nc");
  });

  it("rejects unbalanced or mismatched markers", () => {
    expect(() => applyRegions("// @auric-begin a\nx", on())).toThrow(/never closed/);
    expect(() => applyRegions("// @auric-end a", on())).toThrow(/does not match/);
    expect(() => applyRegions("// @auric-begin a\n// @auric-end b", on())).toThrow(/does not match/);
    expect(() => applyRegions("// @auric-begin a\n// @auric-begin a", on())).toThrow(/already open/);
  });

  it("lists region names", () => {
    expect([...regionNames(src)]).toEqual(["files"]);
  });
});
