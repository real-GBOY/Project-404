import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tokenStore } from "@/config";
import { json, renderApp } from "@/test/render";
import { AppRouter } from "./router";

const OWNER = {
  id: "usr_1",
  email: "ahmed.nabil@hoteltransylvania.com",
  displayName: "Ahmed Nabil",
};

/** A tiny stand-in for the HotelOS API: Core's login, /me and logout routes. */
function fakeApi(opts: { password: string }) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/login")) {
      const body = JSON.parse(String(init?.body)) as { password: string };
      if (body.password !== opts.password) {
        return json(401, { error: { code: "identity.invalid_credentials", message: "Invalid" } });
      }
      return json(201, {
        user: OWNER,
        tokens: { accessToken: "a1", refreshToken: "r1", expiresIn: 900, tokenType: "Bearer" },
        organizations: [],
      });
    }
    if (url.endsWith("/hotel/me/role")) return json(200, { roleKey: "owner", roleName: "Owner" });
    if (url.endsWith("/me")) {
      const auth = new Headers(init?.headers).get("authorization");
      if (auth !== "Bearer a1") return json(401, { error: { code: "auth", message: "no" } });
      return json(200, {
        user: OWNER,
        organizationId: "org_1",
        permissions: ["read:room", "read:guest"],
      });
    }
    if (url.endsWith("/auth/logout")) return new Response(null, { status: 204 });
    if (url.endsWith("/auth/refresh")) return json(401, { error: { code: "auth", message: "no" } });
    return json(404, { error: { code: "not_found", message: "not found" } });
  });
}

describe("HotelOS app shell", () => {
  beforeEach(() => tokenStore.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("sends a signed-out visitor to the sign-in page", async () => {
    vi.stubGlobal("fetch", fakeApi({ password: "pw" }));
    renderApp(<AppRouter />, "/");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows a friendly error for a wrong password and stays on sign-in", async () => {
    vi.stubGlobal("fetch", fakeApi({ password: "pw" }));
    renderApp(<AppRouter />, "/login");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), OWNER.email);
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/don't match/);
    expect(tokenStore.getRefresh()).toBeNull();
  });

  it("signs in, shows role-appropriate navigation and the role label, then signs out", async () => {
    vi.stubGlobal("fetch", fakeApi({ password: "pw" }));
    renderApp(<AppRouter />, "/login");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), OWNER.email);
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: /, Ahmed$/ })).toBeInTheDocument();
    const nav = screen.getByRole("complementary", { name: "Main navigation" });
    expect(nav).toHaveTextContent("Rooms");
    expect(nav).toHaveTextContent("Guests");
    // No read:staff / read:hotel_settings → the Administration group is hidden entirely.
    expect(nav).not.toHaveTextContent("Administration");
    expect(await screen.findByText("Owner")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument(),
    );
    expect(tokenStore.getRefresh()).toBeNull();
  });
});
