import { describe, expect, it } from "vitest";
import { visibleNav, type NavGroup } from "./nav";

const groups: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", to: "/" }] },
  {
    label: "Finance",
    items: [{ label: "Payments", to: "/payments", permission: "read:payment" }],
  },
];

describe("visibleNav", () => {
  it("drops items the user lacks permission for, and then empty groups", () => {
    const nav = visibleNav(groups, () => false);
    expect(nav.map((g) => g.label)).toEqual(["Overview"]);
  });

  it("keeps permitted items", () => {
    const nav = visibleNav(groups, (p) => p === "read:payment");
    expect(nav.map((g) => g.label)).toEqual(["Overview", "Finance"]);
  });
});
