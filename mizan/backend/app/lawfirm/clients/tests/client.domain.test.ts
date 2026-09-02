import { describe, expect, it } from "vitest";
import { cityOf, registrationLabel } from "../client.domain.js";

describe("cityOf", () => {
  it("returns the last comma-separated segment", () => {
    expect(cityOf("12 El-Batal St, Mohandessin, Giza")).toBe("Giza");
  });
  it("returns the whole string when there is no comma", () => {
    expect(cityOf("Cairo")).toBe("Cairo");
  });
  it("returns null for a null / empty address", () => {
    expect(cityOf(null)).toBeNull();
    expect(cityOf("")).toBeNull();
    expect(cityOf("  ,  ")).toBeNull();
  });
});

describe("registrationLabel", () => {
  it("uses the tax id when present", () => {
    expect(registrationLabel({ taxId: "204-889-113", type: "company" })).toBe("204-889-113");
  });
  it("falls back per client type", () => {
    expect(registrationLabel({ taxId: null, type: "individual" })).toBe("National ID on file");
    expect(registrationLabel({ taxId: null, type: "company" })).toBe("Registration on file");
  });
});
