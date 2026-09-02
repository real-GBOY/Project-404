import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { BrowserRouter } from "react-router-dom";
import { queryClient } from "@/lib/api/query-client";
import { i18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { TenantProvider } from "@/lib/tenant/tenant-provider";
import { AppErrorBoundary } from "./error-boundary";

/**
 * Provider composition (outer → inner):
 *   ErrorBoundary → Query → i18n → Router → Auth → Tenant
 * Auth is inside Router because it navigates on logout; Tenant reads Auth.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <BrowserRouter>
            <AuthProvider>
              <TenantProvider>{children}</TenantProvider>
            </AuthProvider>
          </BrowserRouter>
        </I18nextProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
