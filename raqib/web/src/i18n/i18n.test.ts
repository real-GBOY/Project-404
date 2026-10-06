import { describe, expect, it } from "vitest";
import { createI18n } from "./i18n";

describe("i18n", () => {
  it("switches language and direction", () => {
    expect(createI18n("ar").dir).toBe("rtl");
    expect(createI18n("en").dir).toBe("ltr");
    expect(createI18n("en").S("greet", { n: "Saud" })).toBe("Good morning, Saud");
    expect(createI18n("ar").S("greet", { n: "سعود" })).toBe("صباح الخير، سعود");
  });

  it("never translates user-entered text and falls back across languages for master data", () => {
    const i = createI18n("ar");
    expect(i.L("free text typed by a user")).toBe("free text typed by a user");
    expect(i.L({ ar: "", en: "Main Gate" })).toBe("Main Gate");
  });

  it("formats dates with Western digits in both languages", () => {
    expect(createI18n("ar").fd("2026-10-05", "full")).toMatch(/2026/);
    expect(createI18n("en").fd(null)).toBe("—");
  });

  it("has an Arabic and an English value for every string", () => {
    const i = createI18n("en");
    expect(Object.keys(i.t).length).toBeGreaterThan(900);
    expect(Object.values(i.t).every((v) => typeof v === "string" && v.length > 0)).toBe(true);
  });
});
