// Pin the locale so the formatters are deterministic (the real module reads
// the live i18next instance).
jest.mock("@/lib/i18n", () => ({ i18n: { resolvedLanguage: "en" } }));

import { formatFileSize, formatMoney, formatMoneyList, formatRelative } from "./index";

describe("formatFileSize", () => {
  it("scales bytes -> KB -> MB", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(5.5 * 1024 * 1024)).toBe("5.5 MB");
  });
});

describe("formatMoney", () => {
  it("formats one currency amount with grouped digits, and keeps a currency marker", () => {
    const out = formatMoney({ currency: "EGP", amount: "1000" });
    // A currency marker of some kind wraps the grouped number; we don't pin the
    // exact ICU symbol, only that the amount is not rendered bare.
    expect(out).toMatch(/1,000/);
    expect(out.replace(/[\s\u00a0\u202f]/g, "")).not.toBe("1,000");
  });

  it("keeps 2dp only when the amount is non-integer", () => {
    expect(formatMoney({ currency: "EGP", amount: "1234.5" })).toMatch(/1,234\.50/);
    expect(formatMoney({ currency: "EGP", amount: "1234" })).toMatch(/1,234(?!\.)/);
  });

  it("formatMoneyList maps each entry without summing across currencies", () => {
    const lines = formatMoneyList([
      { currency: "EGP", amount: "100" },
      { currency: "USD", amount: "50" },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/100/);
    expect(lines[1]).toMatch(/50/);
  });
});

describe("formatRelative (en)", () => {
  const at = (ms: number) => new Date(Date.now() + ms).toISOString();
  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const MIN = 60_000;

  it("uses the yesterday / tomorrow idiom for a one-day gap", () => {
    expect(formatRelative(at(1.2 * DAY))).toBe("tomorrow");
    expect(formatRelative(at(-1.2 * DAY))).toBe("yesterday");
  });

  it("collapses a sub-minute gap to 'now'", () => {
    expect(formatRelative(at(1000))).toBe("now");
  });

  it("is numeric for larger gaps, with singular / plural nouns", () => {
    expect(formatRelative(at(3 * DAY))).toBe("in 3 days");
    expect(formatRelative(at(-2 * DAY))).toBe("2 days ago");
    expect(formatRelative(at(2 * HOUR))).toBe("in 2 hours");
    expect(formatRelative(at(-1 * HOUR))).toBe("1 hour ago");
    expect(formatRelative(at(30 * MIN))).toBe("in 30 minutes");
  });
});
