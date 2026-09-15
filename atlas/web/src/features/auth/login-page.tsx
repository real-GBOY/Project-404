import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "./auth-provider";

/**
 * The Claude Design prototype has no login screen at all (the frontend ran
 * on a static hardcoded session). This one is new — kept in the same visual
 * language as the sidebar's own wordmark (`components/navigation/sidebar.tsx`)
 * rather than a generic auth-template look.
 */
export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("mostafa.halim@atlas.eg");
  const [password, setPassword] = useState("demo-password-2026");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (auth.status === "authenticated") {
    const to = (location.state as { from?: string } | null)?.from ?? "/dashboard";
    return <Navigate to={to} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await auth.login(email, password);
      const to = (location.state as { from?: string } | null)?.from ?? "/dashboard";
      navigate(to, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-[360px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-sm bg-primary text-[13px] font-bold text-white">
            A
          </div>
          <div>
            <div className="text-[13px] font-semibold tracking-[0.02em]">ATLAS</div>
            <div className="text-[8.5px] uppercase tracking-[0.1em] text-subtle">Real Estate OS</div>
          </div>
        </div>

        <Card className="p-5">
          <h1 className="m-0 text-[15px] font-semibold tracking-[-0.01em]">Sign in</h1>
          <p className="mt-1 text-[11px] text-secondary">Use your Atlas account to continue.</p>
          <p className="mt-1 text-[10px] text-subtle">Demo credentials are pre-filled below.</p>

          <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
              />
            </div>

            {error && (
              <div className="rounded-btn border border-danger-border bg-danger-surface px-2.5 py-2 text-[11px] text-danger">
                {error}
              </div>
            )}

            <Button type="submit" loading={submitting} className="mt-1 w-full">
              Sign in
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
