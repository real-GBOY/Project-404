import { createContext, useContext } from "react";

export type ToastTone = "success" | "error" | "info";

export interface ToastInput {
  title: string;
  description?: string;
  /** ms before auto-dismiss; 0 keeps it until dismissed. Default 5000. */
  duration?: number;
}

export interface ToastApi {
  success: (t: ToastInput) => void;
  error: (t: ToastInput) => void;
  info: (t: ToastInput) => void;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

/** Fire a toast from anywhere under `<ToastProvider>`. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
