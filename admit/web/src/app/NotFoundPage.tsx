import { Link } from "react-router-dom";
import { DEFAULT_ORG } from "@/config/env";

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="display text-6xl">Page not found</h1>
      <p className="text-ink-2">That address does not lead anywhere. Booking links from your email open the booking they were made for.</p>
      <Link to={`/e/${DEFAULT_ORG}`} className="font-semibold">Back to events</Link>
    </main>
  );
}
