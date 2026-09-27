import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/auth-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AppErrorBoundary } from "./error-boundary";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: false } },
});

/** Provider composition (outer → inner): ErrorBoundary → Query → Router → Auth → Toast. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
