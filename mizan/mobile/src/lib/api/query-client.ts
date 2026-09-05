import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "./api-error";

/** Ported from mizan/web/src/lib/api/query-client.ts. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry client errors (4xx) — only transient failures.
        if (isApiError(error) && error.status < 500) return false;
        return failureCount < 1;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
