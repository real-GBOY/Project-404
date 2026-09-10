import { NotFoundState } from "./not-found-state";

/** Full-page 404 for unmatched routes. */
export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <NotFoundState backTo="/dashboard" backLabel="Go to dashboard" />
    </div>
  );
}
