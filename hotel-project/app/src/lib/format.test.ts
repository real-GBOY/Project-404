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
