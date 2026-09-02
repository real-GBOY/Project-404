import { fireEvent, screen } from "@testing-library/react";
import { openOverlay, renderApp } from "@/test/render";
import { UserMenu } from "./user-menu";

// Radix DropdownMenu is Popper-based — keep to a couple of open/close cycles per
// file (see src/test/setup.ts) and drive it synchronously.

const TWO_ORGS = [
  { organizationId: "org_1", slug: "a", name: "Tawfik & Partners", membershipRole: "firm_admin" },
  { organizationId: "org_2", slug: "b", name: "Second Firm", membershipRole: "partner" },
];

describe("UserMenu", () => {
  it("shows the user, hides the org list for one org, and signs out", () => {
    const logout = vi.fn();
    renderApp(<UserMenu />, { perms: [], auth: { logout } });

    // the trigger card already shows the name; opening adds the menu label copy
    expect(screen.getByText("Test User")).toBeInTheDocument();
    openOverlay(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
    expect(screen.queryByText("Organizations")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(logout).toHaveBeenCalledOnce();
  });

  it("lists organizations and switches on selection for a multi-org user", () => {
    const switchTo = vi.fn().mockResolvedValue(undefined);
    renderApp(<UserMenu />, {
      perms: [],
      organizations: TWO_ORGS,
      activeOrg: "org_1",
      tenant: { switchTo },
    });

    openOverlay(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByText("Organizations")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: /Second Firm/ }));
    expect(switchTo).toHaveBeenCalledWith("org_2");
  });
});
