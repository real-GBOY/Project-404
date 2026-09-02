import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { OrganizationSelectPage } from "./organization-select-page";

const ORGS = [
  { organizationId: "org_1", slug: "a", name: "Tawfik & Partners", membershipRole: "firm_admin" },
  { organizationId: "org_2", slug: "b", name: "Second Firm", membershipRole: "partner" },
];

function Harness() {
  return (
    <Routes>
      <Route path="/login/organization" element={<OrganizationSelectPage />} />
      <Route path="/" element={<div>dashboard</div>} />
    </Routes>
  );
}

describe("OrganizationSelectPage", () => {
  it("lists memberships and activates the chosen one", async () => {
    const selectOrganization = vi.fn().mockResolvedValue(undefined);
    const { user } = renderApp(<Harness />, {
      path: "/login/organization",
      organizations: ORGS,
      activeOrg: null,
      auth: { selectOrganization },
    });

    await user.click(screen.getByRole("button", { name: /Second Firm/ }));

    expect(selectOrganization).toHaveBeenCalledWith("org_2");
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
  });

  it("shows a no-organization state with a way out", () => {
    const logout = vi.fn();
    renderApp(<Harness />, {
      path: "/login/organization",
      organizations: [],
      activeOrg: null,
      auth: { logout },
    });

    expect(screen.getByText("No organization yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("redirects away when a tenant is already active", () => {
    renderApp(<Harness />, {
      path: "/login/organization",
      organizations: ORGS,
      activeOrg: "org_1",
    });
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });
});
