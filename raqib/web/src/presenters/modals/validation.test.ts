import { describe, expect, it } from "vitest";
import { missingFields } from "./validation";

describe("data-entry dialogs", () => {
  it("needs a code and both names to create a project, and checks the code's shape", () => {
    expect(missingFields("projNew", {})).toEqual(["code", "nameAr", "nameEn"]);
    const ok = { code: "PRJ-RYD-020", nameAr: "مشروع", nameEn: "Project" };
    expect(missingFields("projNew", ok)).toEqual([]);
    expect(missingFields("projNew", { ...ok, code: "x y" })).toEqual(["code"]);
  });

  it("does not ask for a code when editing a project", () => {
    expect(missingFields("projEdit", { nameAr: "أ", nameEn: "A" })).toEqual([]);
  });

  it("requires a ten-digit national ID for a new guard but lets an edit leave it blank", () => {
    const base = { gproj: "p1", nameAr: "أ", nameEn: "A", emp: "G-1" };
    expect(missingFields("guardNew", { ...base, nid: "12345" })).toEqual(["nid"]);
    expect(missingFields("guardNew", { ...base, nid: "1234567890" })).toEqual([]);
    expect(missingFields("guardEdit", { ...base, nid: "" })).toEqual([]);
    expect(missingFields("guardEdit", { ...base, nid: "12" })).toEqual(["nid"]);
  });

  it("confirms archive and roster changes without extra fields", () => {
    for (const k of ["siteArchive", "areaArchive", "guardOff", "guardOn"])
      expect(missingFields(k, {})).toEqual([]);
  });
});
