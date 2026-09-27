import type { ReactNode } from "react";
import { ApiError } from "@/config";

/** Calm empty / loading / error blocks used inside cards and pages. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-border px-6 py-10 text-center">
      <p className="m-0 text-body font-semibold">{title}</p>
      {children ? <div className="mt-1.5 text-small text-muted">{children}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="py-10 text-center text-small text-muted">
      {label}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const forbidden = error instanceof ApiError && error.status === 403;
  return (
    <div
      role="alert"
      className="rounded-card bg-danger-soft px-5 py-4 text-small font-semibold text-danger"
    >
      {forbidden
        ? "You don't have access to this. Ask a manager if you need it."
        : "Couldn't load this right now. Please refresh and try again."}
    </div>
  );
}
