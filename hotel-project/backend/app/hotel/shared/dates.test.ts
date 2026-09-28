import { describe, expect, it } from "vitest";
import { addDays, dayOfWeek, daysBetween, eachNight, hotelDate, isIsoDate } from "./dates.js";

describe("hotel calendar dates", () => {
  it("validates real calendar dates only", () => {
    expect(isIsoDate("2026-09-27")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("27/09/2026")).toBe(false);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts nights and lists them arrival-inclusive, departure-exclusive", () => {
    expect(daysBetween("2026-09-27", "2026-09-30")).toBe(3);
    expect(eachNight("2026-09-27", "2026-09-30")).toEqual([
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
    ]);
    expect(eachNight("2026-09-27", "2026-09-27")).toEqual([]);
  });

  it("knows the weekday of a night", () => {
    expect(dayOfWeek("2026-09-27")).toBe(0); // Sunday
    expect(dayOfWeek("2026-10-01")).toBe(4); // Thursday
  });

  it("derives today in the hotel's zone, not UTC", () => {
    // 22:30 UTC on Sep 26 is already Sep 27 in Cairo (UTC+3).
    expect(hotelDate(new Date("2026-09-26T22:30:00Z"), "Africa/Cairo")).toBe("2026-09-27");
    expect(hotelDate(new Date("2026-09-26T22:30:00Z"), "UTC")).toBe("2026-09-26");
  });
});
