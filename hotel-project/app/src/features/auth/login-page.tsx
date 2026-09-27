import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError, DEMO_EMAIL, DEMO_PASSWORD } from "@/config";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "./use-auth";

/**
 * Staff sign-in. Not part of the HotelOS design (a gap the audit flagged), so it is composed only
 * from the design's own language: the public-booking card (14px radius, 32px padding), its
 * form fields, the primary button and the danger-soft tone for errors.
 */
export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";
  if (auth.status === "authenticated") return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await auth.login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "That email and password don't match a staff account."
          : "Couldn't sign in right now. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>
        <form
          onSubmit={submit}
          className="rounded-panel border border-border bg-surface p-8"
          aria-label="Sign in"
        >
          <h1 className="m-0 mb-1 text-[20px] font-bold">Sign in</h1>
          <p className="m-0 mb-6 text-body text-muted">Hotel Nayel staff workspace</p>
          <div className="flex flex-col gap-4">
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-control bg-danger-soft px-3.5 py-2.5 text-small font-semibold text-danger"
            >
              {error}
            </div>
          ) : null}
          <Button type="submit" className="mt-6 w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
