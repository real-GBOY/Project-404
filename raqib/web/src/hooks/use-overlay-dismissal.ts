import { useEffect } from "react";
import { setUi, type UiState } from "@/state/ui-store";

const TOAST_MS = 4200;

/** Overlays close themselves: a toast after a few seconds, and every open panel on Escape. */
export function useOverlayDismissal(toast: UiState["toast"]): void {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setUi({ toast: null }), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")
        setUi({ search: false, notif: false, modal: null, more: false, busy: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
