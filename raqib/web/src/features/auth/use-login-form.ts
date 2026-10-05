import { useState, type FormEvent } from "react";
import { useI18n } from "@/hooks/use-i18n";
import { ApiError } from "@/services/http";
import { useAuth } from "./auth-context";

/** Why the person is looking at the sign-in page again, when it was not their choice. */
const REASON_KEYS: Record<string, string> = {
  session_expired: "sessionExpired",
  session_idle: "acct_idle",
  offline: "off_signInNeedsConnection",
  password_changed: "acct_pwDone",
};

/**
 * Sign-in as a two-step form: e-mail and password first; if the account has a second factor the backend answers
 * `raqib.mfa_required` and the code field appears. Wrong codes and locked accounts get their own message.
 */
export function useLoginForm() {
  const { i } = useI18n();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [needOtp, setNeedOtp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const describe = (err: unknown): string | null => {
    if (!(err instanceof ApiError)) return i.S("loadErrBody");
    if (err.code === "raqib.mfa_required") {
      setNeedOtp(true);
      return null;
    }
    if (err.code === "raqib.mfa_invalid") return i.S("acct_otpInvalid");
    if (err.code === "raqib.account_locked")
      return i.S("acct_locked", { m: Number(/(\d+) minute/.exec(err.message)?.[1] ?? 15) });
    return err.status === 401 || err.status === 400 ? i.S("signInFailed") : err.message;
  };

  /** Submit the form, or sign in with the given credentials (the demo accounts do this). */
  const submit = async (e: FormEvent, creds?: { email: string; password: string }) => {
    e.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      await auth.login(
        (creds?.email ?? email).trim(),
        creds?.password ?? password,
        needOtp ? otp.trim() : undefined,
      );
    } catch (err) {
      setFailure(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const reasonKey = auth.error ? REASON_KEYS[auth.error] : undefined;
  return {
    email,
    setEmail,
    password,
    setPassword,
    otp,
    setOtp,
    needOtp,
    busy,
    failure,
    reason: reasonKey ? i.S(reasonKey) : null,
    submit,
  };
}
