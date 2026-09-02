import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import {
  ToastContext,
  type ToastApi,
  type ToastInput,
  type ToastTone,
} from "./toast-context";

interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

const TONE_ICON: Record<ToastTone, string> = {
  success: "check_circle",
  error: "error",
  info: "info",
};
const TONE_CLASS: Record<ToastTone, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-info",
};

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (tone: ToastTone, { title, description, duration = 5000 }: ToastInput) => {
      const id = `toast-${++counter}`;
      setItems((prev) => [...prev, { id, tone, title, description }]);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (t) => push("success", t),
      error: (t) => push("error", t),
      info: (t) => push("info", t),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
        role="region"
        aria-label="Notifications"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live={t.tone === "error" ? "assertive" : "polite"}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-surface p-3 shadow-menu"
          >
            <Icon
              name={TONE_ICON[t.tone]}
              size={18}
              className={cn("mt-px flex-none", TONE_CLASS[t.tone])}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-foreground">{t.title}</div>
              {t.description && <div className="mt-0.5 text-[12px] text-muted">{t.description}</div>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="flex size-6 flex-none items-center justify-center rounded-sm text-muted hover:bg-surface-subtle hover:text-foreground"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
