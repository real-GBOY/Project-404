import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tokenStore } from "@/config";
import { AuthProvider } from "@/features/auth/auth-provider";
import { AppRouter } from "./router";

const OWNER = { id: "usr_1", email: "ahmed.nabil@hotelnayel.com", displayName: "Ahmed Nabil" };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

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
    if (url.endsWith("/me")) {
      const auth = new Headers(init?.headers).get("authorization");
      if (auth !== "Bearer a1") return json(401, { error: { code: "auth", message: "no" } });
      return json(200, { user: OWNER, organizationId: "org_1", permissions: ["*:*"] });
    }
    if (url.endsWith("/auth/logout")) return new Response(null, { status: 204 });
    if (url.endsWith("/auth/refresh")) return json(401, { error: { code: "auth", message: "no" } });
    return json(404, { error: { code: "not_found", message: "not found" } });
  });
}

function renderApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("HotelOS app shell", () => {
  beforeEach(() => tokenStore.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("sends a signed-out visitor to the sign-in page", async () => {
    vi.stubGlobal("fetch", fakeApi({ password: "pw" }));
    renderApp("/");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows a friendly error for a wrong password and stays on sign-in", async () => {
    vi.stubGlobal("fetch", fakeApi({ password: "pw" }));
    renderApp("/login");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), OWNER.email);
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/don't match/);
    expect(tokenStore.getRefresh()).toBeNull();
  });

  it("signs in into the shell, greets the user by first name, and signs out", async () => {
    vi.stubGlobal("fetch", fakeApi({ password: "pw" }));
    renderApp("/login");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), OWNER.email);
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: /, Ahmed$/ })).toBeInTheDocument();
    const nav = screen.getByRole("complementary", { name: "Main navigation" });
    expect(nav).toHaveTextContent("Dashboard");
    expect(screen.getByText("Ahmed Nabil")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument(),
    );
    expect(tokenStore.getRefresh()).toBeNull();
  });
});
