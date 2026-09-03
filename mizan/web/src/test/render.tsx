/* eslint-disable react-refresh/only-export-components -- test-only helpers, not in the HMR graph */
import type { ReactElement, ReactNode } from "react";
import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { i18n } from "@/lib/i18n";
import { tokenStore } from "@/lib/auth/token-store";
import { AuthContext, type AuthContextValue } from "@/lib/auth/auth-context";
import { TenantContext, type TenantContextValue } from "@/lib/tenant/tenant-context";
import type { AuthUser, OrganizationMembership } from "@/types/auth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <TooltipProvider delayDuration={0}>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </I18nextProvider>
  );
}

/** Render a component with i18n + tooltip + toast context, and a bound userEvent. */
export function renderWithProviders(ui: ReactElement) {
  return { user: userEvent.setup({ delay: null }), ...render(ui, { wrapper: Wrapper }) };
}

const TEST_USER: AuthUser = {
  id: "usr_test",
  email: "test@tawfikpartners.eg",
  displayName: "Test User",
  status: "active",
  emailVerified: true,
  locale: "en",
};

const TEST_ORGS: OrganizationMembership[] = [
  { organizationId: "org_1", slug: "tawfik", name: "Mizan", membershipRole: "firm_admin" },
];

function base64Url(json: unknown): string {
  return btoa(JSON.stringify(json)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Seed the token store with a decodable access token carrying `perms`/`org`. */
export function seedTestToken(perms: string[], org: string | null = "org_1"): void {
  const now = Math.floor(Date.now() / 1000);
  const token = `${base64Url({ alg: "none" })}.${base64Url({
    sub: TEST_USER.id,
    email: TEST_USER.email,
    org,
    perms,
    iat: now,
    exp: now + 3600,
  })}.sig`;
  tokenStore.set(token, "test-refresh");
}

export interface AppRenderOptions {
  path?: string;
  perms?: string[];
  status?: AuthContextValue["status"];
  user?: AuthUser | null;
  organizations?: OrganizationMembership[];
  activeOrg?: string | null;
  auth?: Partial<AuthContextValue>;
  tenant?: Partial<TenantContextValue>;
}

/**
 * Render inside a MemoryRouter with stubbed Auth + Tenant context and a fresh
 * QueryClient. `perms` is written to the token store (which `usePermissions`
 * reads directly).
 */
export function renderApp(ui: ReactElement, opts: AppRenderOptions = {}) {
  const {
    path = "/",
    perms = [],
    status = "authed",
    user = TEST_USER,
    organizations = TEST_ORGS,
    activeOrg = organizations[0]?.organizationId ?? null,
    auth = {},
    tenant = {},
  } = opts;

  seedTestToken(perms, activeOrg);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const authValue: AuthContextValue = {
    status,
    user,
    memberships: organizations,
    sessionVersion: 0,
    login: async () => ({ needsOrgSelection: false, hasNoOrg: false }),
    selectOrganization: async () => {},
    setSession: () => {},
    refreshMe: async () => {},
    logout: async () => {},
    ...auth,
  };

  const tenantValue: TenantContextValue = {
    organizationId: activeOrg,
    organization: organizations.find((o) => o.organizationId === activeOrg) ?? null,
    organizations,
    switchTo: async () => {},
    ...tenant,
  };

  return {
    user: userEvent.setup({ delay: null }),
    ...render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={[path]}>
            <AuthContext.Provider value={authValue}>
              <TenantContext.Provider value={tenantValue}>
                <TooltipProvider delayDuration={0}>
                  <ToastProvider>{ui}</ToastProvider>
                </TooltipProvider>
              </TenantContext.Provider>
            </AuthContext.Provider>
          </MemoryRouter>
        </I18nextProvider>
      </QueryClientProvider>,
    ),
  };
}

/*
 * Open a Radix overlay trigger via raw pointer/click events — SYNCHRONOUSLY.
 *
 * Under jsdom, awaiting an `act` flush (which `userEvent`, `waitFor` and
 * `findBy*` all do internally) while a @floating-ui overlay is mounted stalls
 * for ~15s: floating-ui re-measures against jsdom's all-zero rects on every
 * flushed pass. Radix overlays open synchronously on `pointerdown`+`pointerup`
 * (menus, select) or `click` (popover) and the content is immediately in the
 * DOM, so open with `fireEvent` and assert with synchronous `getBy*` — never
 * `await` anything while the overlay is open.
 */
export function openOverlay(trigger: HTMLElement, via: "pointer" | "click" = "pointer") {
  if (via === "click") {
    fireEvent.click(trigger);
    return;
  }
  fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
  fireEvent.pointerUp(trigger, { button: 0, pointerType: "mouse" });
}
