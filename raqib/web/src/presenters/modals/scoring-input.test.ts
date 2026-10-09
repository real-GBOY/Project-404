import { describe, expect, it } from "vitest";
import { createI18n } from "@/i18n/i18n";
import { shiftLabel } from "../common";
import { parseItemAmounts } from "./handlers/scoring";

describe("deduction values typed in the dialog", () => {
  it("reads one `item = points` per line and ignores blank lines", () => {
    expect(parseItemAmounts("q9 = 12\n\n q2:5 \r\nitem.3=0")).toEqual({
      q9: 12,
      q2: 5,
      "item.3": 0,
    });
    expect(parseItemAmounts("")).toEqual({});
  });

  it("rejects anything that is not a key and whole points from 0 to 100", () => {
    for (const bad of ["q9", "q9 = x", "q9 = 101", "q9 = 1.5", "= 5", "q9 = -2"])
      expect(parseItemAmounts(bad)).toBeNull();
  });
});

describe("12-hour times", () => {
  it("shows stored 24-hour times on a 12-hour clock in both languages, with Western digits", () => {
    const en = createI18n("en");
    const ar = createI18n("ar");
    expect(en.ft("00:05")).toBe("12:05 AM");
    expect(en.ft("09:30")).toBe("9:30 AM");
    expect(en.ft("12:00")).toBe("12:00 PM");
    expect(en.ft("14:45")).toBe("2:45 PM");
    expect(ar.ft("14:45")).toMatch(/^2:45\s*م$/);
    expect(ar.ft("09:30")).toMatch(/^9:30\s*ص$/);
  });

  it("leaves a value that is not a time as it is", () => {
    expect(createI18n("en").ft("soon")).toBe("soon");
    expect(createI18n("en").ft(null)).toBe("—");
  });
});

describe("shift names", () => {
  const i = createI18n("en");
  it("uses the organization's configured name, falling back to the original three", () => {
    const data = {
      shifts: [
        { key: "day", name: { ar: "نهارية", en: "Day shift" }, start: "06:00", end: "14:00" },
      ],
    };
    expect(shiftLabel({ i, data }, "day")).toBe("Day shift");
    expect(shiftLabel({ i, data }, "morning")).toBe("Morning");
    expect(shiftLabel({ i, data: {} }, "night")).toBe("Night");
  });
});
