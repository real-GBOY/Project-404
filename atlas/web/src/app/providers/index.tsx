import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/auth-provider";
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
 *   ErrorBoundary → Query → Router → Auth → Notifications → Confirm → Toast
 * Auth and Notifications are both backed by the real API (see
 * `features/auth/auth-provider.tsx` and `lib/notifications/notifications-provider.tsx`).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <NotificationsProvider>
              <ConfirmProvider>
                <ToastProvider>{children}</ToastProvider>
              </ConfirmProvider>
            </NotificationsProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
