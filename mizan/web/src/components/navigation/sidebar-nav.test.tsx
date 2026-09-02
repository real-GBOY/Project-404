import { screen, within } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { SidebarNav } from "./sidebar-nav";

describe("SidebarNav", () => {
  it("shows only items the session can read, and drops empty groups", () => {
    renderApp(<SidebarNav />, { perms: ["read:dashboard", "read:client"] });

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clients" })).toBeInTheDocument();
    // no read:matter / read:invoice / read:staff
    expect(screen.queryByRole("link", { name: "Matters" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Finance" })).not.toBeInTheDocument();
    expect(screen.queryByText("Firm")).not.toBeInTheDocument();
    // Notifications has no perm gate — always visible
    expect(screen.getByRole("link", { name: "Notifications" })).toBeInTheDocument();
  });

  it("marks the active route with aria-current", () => {
    renderApp(<SidebarNav />, { path: "/matters/mat_9", perms: ["read:matter", "read:dashboard"] });
    const matters = screen.getByRole("link", { name: "Matters" });
    expect(matters).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("keeps Settings active on its sub-routes", () => {
    renderApp(<SidebarNav />, { path: "/settings/users", perms: ["read:lawfirm_setting"] });
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  });

  it("groups items under their collapsible section heading", () => {
    renderApp(<SidebarNav />, { perms: ["read:client", "read:matter"] });
    const group = screen.getByRole("button", { name: /Workspace/ }).parentElement as HTMLElement;
    expect(within(group).getByRole("link", { name: "Clients" })).toBeInTheDocument();
  });

  it("collapses a section when its heading is clicked", () => {
    const { user } = renderApp(<SidebarNav />, { perms: ["read:client"] });
    expect(screen.getByRole("link", { name: "Clients" })).toBeInTheDocument();
    return user.click(screen.getByRole("button", { name: /Workspace/ })).then(() => {
      expect(screen.queryByRole("link", { name: "Clients" })).not.toBeInTheDocument();
    });
  });
});
