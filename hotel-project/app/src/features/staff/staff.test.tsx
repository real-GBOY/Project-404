import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, renderApp, stubApi } from "@/test/render";
import { StaffPage } from "./staff-page";

const MATRIX = {
  permissions: [
    { key: "read:guest", action: "read", resource: "guest", description: "View guests" },
    { key: "create:guest", action: "create", resource: "guest", description: null },
  ],
  roles: [
    {
      key: "owner",
      name: "Owner",
      description: null,
      permissionKeys: ["create:guest", "read:guest"],
    },
    { key: "housekeeping", name: "Housekeeping", description: null, permissionKeys: [] },
  ],
};

const OWNER_ROW = {
  userId: "usr_owner",
  name: "Ahmed Nabil",
  email: "ahmed.nabil@hoteltransylvania.com",
  roleKey: "owner",
  roleName: "Owner",
  status: "active",
  joinedAt: "2026-01-01T00:00:00Z",
  lastActiveAt: null,
};

const STAFF = [
  OWNER_ROW,
  {
    userId: "usr_me",
    name: "Mona Farid",
    email: "mona.farid@hoteltransylvania.com",
    roleKey: "manager",
    roleName: "Manager",
    status: "active",
    joinedAt: "2026-01-01T00:00:00Z",
    lastActiveAt: null,
  },
  {
    userId: "usr_2",
    name: "Hassan Ali",
    email: "hassan.ali@hoteltransylvania.com",
    roleKey: "housekeeping",
    roleName: "Housekeeping",
    status: "active",
    joinedAt: "2026-01-01T00:00:00Z",
    lastActiveAt: null,
  },
];

const routes = [
  (url: URL) => (url.pathname.endsWith("/hotel/staff") ? json(200, { items: STAFF }) : undefined),
  (url: URL) => (url.pathname.endsWith("/hotel/roles") ? json(200, MATRIX) : undefined),
];

describe("StaffPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lets a staff manager change other people's roles but never their own", async () => {
    stubApi({ permissions: ["read:staff", "manage:staff"], routes });
    renderApp(<StaffPage />);
    expect(
      await screen.findByRole("combobox", { name: "Role for Hassan Ali" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Role for Mona Farid" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add staff" })).toBeInTheDocument();
  });

  it("never offers a manager the Owner role or edits on the owner's row", async () => {
    stubApi({ permissions: ["read:staff", "manage:staff"], routes });
    renderApp(<StaffPage />);
    const hassan = await screen.findByRole("combobox", { name: "Role for Hassan Ali" });
    expect(within(hassan).queryByRole("option", { name: "Owner" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Role for Ahmed Nabil" }),
    ).not.toBeInTheDocument();
  });

  it("is read-only without manage:staff", async () => {
    stubApi({ permissions: ["read:staff"], routes });
    renderApp(<StaffPage />);
    expect(await screen.findByText("Hassan Ali")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Add staff" })).not.toBeInTheDocument();
  });

  it("shows the role matrix with allowed/not-allowed marks per role", async () => {
    stubApi({ permissions: ["read:staff"], routes });
    renderApp(<StaffPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Roles & Permissions" }));
    expect(await screen.findAllByLabelText("Allowed")).toHaveLength(2);
    const roles = screen.getByRole("tablist", { name: "Roles" });
    await user.click(within(roles).getByRole("tab", { name: "Housekeeping" }));
    expect(screen.getAllByLabelText("Not allowed")).toHaveLength(2);
  });
});
