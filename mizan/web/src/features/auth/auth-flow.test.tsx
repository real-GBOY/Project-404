import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { i18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { TenantProvider } from "@/lib/tenant/tenant-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";
import { AppRouter } from "@/app/router";
import { server } from "@/test/msw/server";
import { DEV_ORGS, DEV_USER, makeDevAccessToken } from "@/test/msw/dev-session";

function renderApp(path = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    user: userEvent.setup({ delay: null }),
    ...render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={[path]}>
            <AuthProvider>
              <TenantProvider>
                <TooltipProvider delayDuration={0}>
                  <ToastProvider>
                    <AppRouter />
                  </ToastProvider>
                </TooltipProvider>
              </TenantProvider>
            </AuthProvider>
          </MemoryRouter>
        </I18nextProvider>
      </QueryClientProvider>,
    ),
  };
}

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Email"), "amira@tawfik.eg");
  await user.type(screen.getByLabelText("Password"), "a-good-long-password");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("auth flow (integration, MSW-backed)", () => {
  it("an unauthenticated visit to a protected route lands on the login form", async () => {
    renderApp("/matters");
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("signs in with a single organization and lands in the app shell", async () => {
    const { user } = renderApp("/");
    await signIn(user);

    // Dashboard placeholder + the permission-aware sidebar are now mounted.
    expect(await screen.findByRole("link", { name: "Matters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
  });

  it("routes a multi-org sign-in through the organization selector", async () => {
    // Backend returns an orgless token when the user belongs to several orgs.
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json({
          user: DEV_USER,
          tokens: {
            accessToken: makeDevAccessToken(null),
            refreshToken: "dev-refresh-token",
            expiresIn: 900,
            tokenType: "Bearer",
          },
          organizations: DEV_ORGS,
        }),
      ),
      http.get("/api/me", () =>
        HttpResponse.json({ user: DEV_USER, organizationId: null, permissions: [] }),
      ),
    );

    const { user } = renderApp("/");
    await signIn(user);

    expect(await screen.findByText("Choose an organization")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mizan/ })).toBeInTheDocument();
  });
});
