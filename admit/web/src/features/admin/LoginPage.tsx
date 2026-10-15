import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { Logo } from "@/components/Logo";
import { Notice } from "@/components/Notice";
import { ApiError } from "@/services/http";
import { isDoorOnly, useAuth } from "./auth";

const REASONS: Record<string, string> = {
  session_expired: "Your session ended. Sign in again to continue.",
  password_changed: "Your password was changed. Sign in with the new one.",
  network: "We could not reach the server. Check your connection.",
};

export function LoginPage({ to = "/admin" }: { to?: string }) {
  const { status, error, login, can } = useAuth();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (status === "authenticated")
    return <Navigate to={isDoorOnly(can) ? "/scan" : (loc.state?.from ?? to)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setMessage(
        err instanceof ApiError && err.status === 429
          ? "Too many sign-in attempts. Wait a minute and try again."
          : err instanceof ApiError && (err.status === 401 || err.status === 400)
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
    </main>
  );
}
