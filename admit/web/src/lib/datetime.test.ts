import { describe, expect, it } from "vitest";
import { fromInputValue, slugify, toInputValue } from "./datetime";

describe("organizer-zone date inputs", () => {
  it("round-trips an instant through the Cairo wall clock", () => {
    for (const iso of [
      "2026-11-14T18:00:00.000Z",
      "2026-07-01T09:30:00.000Z",
      "2026-01-15T23:45:00.000Z",
    ]) {
      expect(fromInputValue(toInputValue(iso))).toBe(iso);
    }
  });
  it("shows UTC+2 in winter and the daylight offset in summer", () => {
    expect(toInputValue("2026-01-15T18:00:00.000Z")).toBe("2026-01-15T20:00");
    expect(toInputValue("2026-07-15T18:00:00.000Z")).toBe("2026-07-15T21:00");
  });
  it("rejects half-typed values", () => {
    expect(fromInputValue("2026-11-14")).toBe("");
    expect(toInputValue("")).toBe("");
  });
  it("slugifies titles for public addresses", () => {
    expect(slugify("Cairo Jazz Nights: The Nile Sessions!")).toBe(
      "cairo-jazz-nights-the-nile-sessions",
    );
    expect(slugify("  Café  Déjà Vu  ")).toBe("cafe-deja-vu");
  });
});
