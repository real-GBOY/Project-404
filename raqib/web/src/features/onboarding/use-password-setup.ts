import { useState } from "react";
import { api } from "@/api";
import { ApiError } from "@/services/http";

export interface PasswordSetupState {
  a: string;
  b: string;
  state: "valid" | "used" | "invalid";
  busy: boolean;
}

/** Choose a password from the emailed link (`?token=`). A rejected link reads as invalid; a network failure just lets them retry. */
export function usePasswordSetup() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [s, setS] = useState<PasswordSetupState>({
    a: "",
    b: "",
    state: token ? "valid" : "invalid",
    busy: false,
  });
  const patch = (p: Partial<PasswordSetupState>) => setS((x) => ({ ...x, ...p }));

  const submit = () => {
    patch({ busy: true });
    api.public
      .setPassword(token, s.a)
      .then(() => patch({ busy: false, state: "used" }))
      .catch((err: unknown) =>
        patch({ busy: false, ...(err instanceof ApiError ? { state: "invalid" as const } : {}) }),
      );
  };
  return { s, patch, submit };
}
