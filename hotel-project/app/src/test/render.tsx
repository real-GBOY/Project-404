import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import { ToastProvider } from "@/components/ui/toast";
import { tokenStore } from "@/config";

type Handler = (
  url: URL,
  init: RequestInit | undefined,
) => Response | Promise<Response> | undefined;

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * A stand-in for the HotelOS API: a signed-in user (Core `/me`) plus whatever routes the test
 * adds. Unmatched routes answer 404 so a missing stub fails loudly instead of hanging.
 */
export function stubApi(opts: { permissions: string[]; displayName?: string; routes?: Handler[] }) {
  tokenStore.set("access-token", "refresh-token");
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname.endsWith("/me")) {
      return json(200, {
        user: {
          id: "usr_me",
          email: "me@hotelnayel.com",
          displayName: opts.displayName ?? "Mona Farid",
        },
        organizationId: "org_1",
        permissions: opts.permissions,
      });
    }
    if (url.pathname.endsWith("/hotel/me/role"))
      return json(200, { roleKey: "manager", roleName: "Manager" });
    for (const handler of opts.routes ?? []) {
      const res = await handler(url, init);
      if (res) return res;
    }
    return json(404, { error: { code: "not_found", message: `No stub for ${url.pathname}` } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Render with every app provider around it, at `path`. */
export function renderApp(ui: ReactElement, path = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <ToastProvider>{ui}</ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
