import { describe, expect, it } from "vitest";
import { firstName, formatLongDate, greeting, initials } from "./format";

describe("hotel-local formatting", () => {
  it("formats dates in Cairo time, not the machine's", () => {
    // 23:30 UTC on Sep 26 is already Sep 27 in Cairo (UTC+3 in September).
    expect(formatLongDate(new Date("2026-09-26T23:30:00Z"))).toBe("Sunday, September 27, 2026");
  });

  it("greets by the hotel's local hour", () => {
    expect(greeting(new Date("2026-09-27T05:00:00Z"))).toBe("Good morning"); // 08:00 Cairo
    expect(greeting(new Date("2026-09-27T11:00:00Z"))).toBe("Good afternoon"); // 14:00 Cairo
    expect(greeting(new Date("2026-09-27T17:00:00Z"))).toBe("Good evening"); // 20:00 Cairo
  });

  it("derives first names and initials", () => {
    expect(firstName("Ahmed Nabil")).toBe("Ahmed");
    expect(initials("Mona Farid")).toBe("MF");
    expect(initials(null)).toBe("");
  });
});

describe("money and relative time", () => {
  it("formats EGP like the design", async () => {
    const { formatEgp } = await import("./format");
    expect(formatEgp(4200)).toBe("4,200 EGP");
    expect(formatEgp(1234.5)).toBe("1,234.50 EGP");
  });

  it("describes last-active times in words", async () => {
    const { formatRelative } = await import("./format");
    const now = new Date("2026-09-27T12:00:00Z");
    expect(formatRelative(null, now)).toBe("Never");
    expect(formatRelative("2026-09-27T11:59:40Z", now)).toBe("Just now");
    expect(formatRelative("2026-09-27T11:48:00Z", now)).toBe("12 min ago");
    expect(formatRelative("2026-09-27T09:00:00Z", now)).toBe("3 hr ago");
    expect(formatRelative("2026-09-26T09:00:00Z", now)).toBe("Yesterday");
  });
});
