import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { pathFor } from "./routes";
import type { Ctx } from "@/presenters/context";
import { setUi } from "@/state/ui-store";

/** Navigate to a screen, closing any open overlay and optionally setting UI state for the screen being opened. */
export function useGo(): Ctx["go"] {
  const navigate = useNavigate();
  return useCallback<Ctx["go"]>(
    (n, id, extra) => {
      setUi({ ...(extra ?? {}), search: false, notif: false, more: false, modal: null });
      navigate(pathFor(n, id));
    },
    [navigate],
  );
}
