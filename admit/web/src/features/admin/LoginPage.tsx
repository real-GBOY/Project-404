import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { Logo } from "@/components/Logo";
import { Notice } from "@/components/Notice";
import { DEMO_MODE, DEMO_PASSWORD } from "@/config/env";
import { ApiError } from "@/services/http";
import { useAuth } from "./auth";

const DEMO_ACCOUNTS = [
  ["Owner", "salma@nilesessions.example"],
  ["Event manager", "dalia@nilesessions.example"],
  ["Payment reviewer", "karim@nilesessions.example"],
  ["Door staff", "ali@nilesessions.example"],
  ["Viewer", "mona@nilesessions.example"],
] as const;

const REASONS: Record<string, string> = {
  session_expired: "Your session ended. Sign in again to continue.",
  network: "We could not reach the server. Check your connection.",
};

export function LoginPage({ to = "/admin" }: { to?: string }) {
  const { status, error, login } = useAuth();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (status === "authenticated") return <Navigate to={loc.state?.from ?? to} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setMessage(
        err instanceof ApiError && (err.status === 401 || err.status === 400)
          ? "That email and password do not match an account."
          : err instanceof ApiError
            ? err.message
            : "We could not reach the server. Check your connection.",
      );
      setBusy(false);
    }
  };

  const reason = message ?? (error ? REASONS[error] : null);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-10">
      <Logo size={30} />
      <h1 className="display text-5xl">Organizer sign in</h1>
      <form onSubmit={submit} className="flex flex-col gap-4" aria-label="Sign in">
        {reason ? <Notice tone="bad">{reason}</Notice> : null}
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" loading={busy} block>
          Sign in
        </Button>
      </form>
      {DEMO_MODE ? (
        <section className="border-t border-rule-strong pt-4" aria-label="Demo accounts">
          <p className="label mb-2 text-muted">Demo accounts</p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {DEMO_ACCOUNTS.map(([role, mail]) => (
              <li key={mail}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(mail);
                    setPassword(DEMO_PASSWORD);
                  }}
                  className="flex w-full items-baseline justify-between rounded-sm border border-rule-strong bg-surface px-3 py-2 text-left text-sm hover:border-ink"
                >
                  <span className="font-semibold">{role}</span>
                  <span className="font-mono text-xs text-muted">{mail}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
