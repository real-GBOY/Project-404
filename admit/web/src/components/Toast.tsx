import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

interface ToastApi {
  /** Toasts confirm instant, local actions only (copied, saved draft). Server work gets a persistent indicator on the record. */
  show(message: string): void;
}
const Ctx = createContext<ToastApi>({ show: () => undefined });
// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((m: string) => {
    clearTimeout(timer.current);
    setMessage(m);
    timer.current = setTimeout(() => setMessage(null), 3000);
  }, []);
  const api = useMemo(() => ({ show }), [show]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {message ? (
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-sm bg-ink px-4 py-3 text-sm text-paper shadow-float">
            <span aria-hidden="true" className="text-[#7fd1a4]">
              ✓
            </span>
            {message}
          </div>
        ) : null}
      </div>
    </Ctx.Provider>
  );
}
