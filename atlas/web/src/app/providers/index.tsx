import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { NOTIFICATIONS_SEED } from "@/mocks/seed-notifications";
import { NotificationsProvider } from "@/lib/notifications/notifications-provider";
import { ConfirmProvider } from "@/lib/confirm/confirm-provider";
import { ToastProvider } from "@/lib/toast/toast-provider";
import { AppErrorBoundary } from "./error-boundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: false,
    },
  },
});

/**
 * Provider composition (outer → inner):
 *   ErrorBoundary → Query → Router → Notifications → Confirm → Toast
 * No auth/tenant provider yet — frontend-only phase renders a static demo
 * session (see `lib/session.ts`); swap this in wholesale once a real backend
 * exists.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NotificationsProvider initial={NOTIFICATIONS_SEED}>
            <ConfirmProvider>
              <ToastProvider>{children}</ToastProvider>
            </ConfirmProvider>
          </NotificationsProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
