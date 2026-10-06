import { useState } from "react";

export interface Flash {
  ok: boolean;
  text: string;
}

/**
 * Run one account-security command with a shared "busy" flag and a message for the page when it fails.
 * `onError` turns the failure into text (usually via `messageFor`).
 */
export function useSecurityAction(setFlash: (f: Flash | null) => void) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>, onError: (e: unknown) => string) => {
    setBusy(true);
    setFlash(null);
    try {
      await fn();
    } catch (e) {
      setFlash({ ok: false, text: onError(e) });
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}
