import { describe, expect, it } from "vitest";
import type { Me, RoleKey, Template } from "@/api/types";
import { visibleNav } from "./nav";

const none = (): Template => ({
  projects: "",
  visits: "",
  inspections: "",
  guardEval: "",
  observations: "",
  actions: "",
  training: "",
  reports: "",
  analytics: "",
  forms: "",
  users: "",
  permissions: "",
  audit: "",
  settings: "",
});
const me = (role: RoleKey, permissions: Partial<Template>): Me => ({
  id: "u1",
  name: { ar: "x", en: "x" },
  ini: { ar: "x", en: "x" },
  role,
  title: { ar: "x", en: "x" },
  email: "x@x",
  employeeNo: null,
  status: "active",
  lastActiveAt: null,
  scope: "all",
  permissions: { ...none(), ...permissions },
  organizationId: "o",
  today: "2026-10-05",
});

describe("visibleNav (UX only — the backend enforces every route)", () => {
  it("offers a module only when the template grants View", () => {
    expect(
      visibleNav(
        me("qm", {
          projects: "VAEDX",
          users: "VAEPX",
          permissions: "VE",
          settings: "VE",
          guardEval: "VRPX",
        }),
      ),
    ).toEqual([
      "overview",
      "projects",
      "guards",
      "users",
      "permissions",
      "settings",
      "confidential",
      "account",
    ]);
    expect(visibleNav(me("pm", { projects: "VD" }))).toEqual(["overview", "projects", "account"]);
  });

  it("follows an edited template, not the role name", () => {
    expect(visibleNav(me("ins", {}))).toEqual(["overview", "account"]);
    expect(visibleNav(me("ins", { projects: "V" }))).toEqual(["overview", "account"]); // inspectors' nav never includes projects
  });
});
