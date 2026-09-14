import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

export type ToastKind = "info" | "success" | "warning" | "danger";

export interface ToastInput {
  kind?: ToastKind;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  /** ms before auto-dismiss; 0 disables */
  duration?: number;
}

interface ToastItem extends Required<Pick<ToastInput, "title">> {
  id: string;
  kind: ToastKind;
  body?: string;
  action?: ToastInput["action"];
}

const KIND_DOT: Record<ToastKind, string> = {
  info: "bg-primary",
  success: "bg-success-strong",
  warning: "bg-warning-solid",
  danger: "bg-danger-solid",
};

interface ToastContextValue {
  push: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const item: ToastItem = { id, kind: input.kind ?? "info", title: input.title, body: input.body, action: input.action };
      setItems((prev) => [...prev, item]);
      const duration = input.duration ?? 5000;
      if (duration > 0) setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[320px] max-w-[92vw] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-card border border-[#26262a] bg-foreground px-3.5 py-3 text-white"
            style={{ animation: "slidein .18s ease" }}
          >
            <div className="flex items-center gap-2">
              <span className={cn("size-1.5 flex-none rounded-full", KIND_DOT[t.kind])} />
              <span className="flex-1 text-[9px] font-semibold uppercase tracking-[0.09em] text-white/60">
                {t.kind}
              </span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="text-white/50 hover:text-white"
              >
                <Icon name="close" size={12} />
              </button>
            </div>
            <div className="mt-1.5 text-[12px] font-semibold">{t.title}</div>
            {t.body && <div className="mt-0.5 text-[11px] text-white/70">{t.body}</div>}
            {t.action && (
              <button
                type="button"
                onClick={t.action.onClick}
                className="mt-2 text-[11px] font-semibold text-primary-surface hover:underline"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
