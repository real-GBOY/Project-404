import { useState, type FormEvent } from "react";
import { api } from "@/api";
import { ApiError } from "@/services/http";

/**
 * Ask for a reset link. The answer never says whether the address is registered: only a rate limit or a network problem is
 * reported; a refusal about the address itself reads as success.
 */
export function useForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      await api.auth.forgot(email.trim());
      setDone(true);
    } catch (err) {
      const addressProblem = err instanceof ApiError && err.status < 500 && err.status !== 429;
      setDone(addressProblem);
      setFailed(!addressProblem);
    } finally {
      setBusy(false);
    }
  };
  return { email, setEmail, busy, done, failed, submit };
}
