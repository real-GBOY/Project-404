import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { errorText } from "@/lib/errors";
import { Button } from "./Button";

/** Loading / error / empty / data in one place, so no screen invents its own. */
export function QueryState<T>({
  query,
  children,
  skeleton,
  empty,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
  empty?: (data: T) => boolean | ReactNode;
}) {
  if (query.isPending)
    return (
      <>
        {skeleton ?? (
          <p role="status" aria-busy="true" className="text-sm text-ink-2">
            Loading…
          </p>
        )}
      </>
    );
  if (query.isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-sm border border-bad-line bg-bad-bg p-4 text-sm text-bad-ink"
      >
        <span>
          <strong>✕ Could not load this.</strong> {errorText(query.error)}
        </span>
        <Button size="sm" variant="ink" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  const e = empty?.(query.data);
  if (e) return <>{e === true ? null : e}</>;
  return <>{children(query.data)}</>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse bg-sunken ${className}`} />;
}
