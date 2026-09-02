import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ErrorState } from "./error-state";
import { NotFoundState } from "./not-found-state";
import { isApiError } from "@/lib/api/api-error";

interface QueryBoundaryProps<T> {
  query: UseQueryResult<T>;
  /** shown while pending — match the real content geometry */
  loading: ReactNode;
  /** shown when the data is "empty" per `isEmpty` */
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  /** render the loaded data */
  children: (data: T) => ReactNode;
}

/**
 * Wires a query's loading / error / 404 / empty / data states the same way
 * everywhere (ARCHITECTURE §7). A 404 from the API renders `<NotFoundState>`;
 * other errors render `<ErrorState>` with retry.
 */
export function QueryBoundary<T>({ query, loading, empty, isEmpty, children }: QueryBoundaryProps<T>) {
  if (query.isPending) return <>{loading}</>;
  if (query.isError) {
    if (isApiError(query.error) && query.error.isNotFound) return <NotFoundState />;
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (empty && isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
