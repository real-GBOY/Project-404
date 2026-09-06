// Same formatters, Arabic locale — exercises the hand-rolled CLDR plural logic
// (`arPluralIndex`) and the dual-form nouns that drop the numeral.
jest.mock("@/lib/i18n", () => ({ i18n: { resolvedLanguage: "ar" } }));

import { formatRelative } from "./index";

const at = (ms: number) => new Date(Date.now() + ms).toISOString();
const DAY = 86_400_000;
const HOUR = 3_600_000;

describe("formatRelative (ar)", () => {
  it("uses the أمس / غدًا idiom for a one-day gap", () => {
    expect(formatRelative(at(-DAY))).toBe("أمس");
    expect(formatRelative(at(DAY))).toBe("غدًا");
  });

  it("drops the numeral for the dual form (2)", () => {
    // "منذ يومين", not "منذ 2 يوم"
    expect(formatRelative(at(-2 * DAY))).toBe("منذ يومين");
    expect(formatRelative(at(-1 * HOUR))).toBe("منذ ساعة");
  });

  it("uses the 'few' plural (3–10) with the numeral", () => {
    expect(formatRelative(at(-3 * DAY))).toBe("منذ 3 أيام");
    expect(formatRelative(at(4 * HOUR))).toBe("خلال 4 ساعات");
  });

  it("uses the 'many' plural (11+) — singular accusative noun", () => {
    expect(formatRelative(at(-15 * 60_000))).toBe("منذ 15 دقيقة");
  });
});
