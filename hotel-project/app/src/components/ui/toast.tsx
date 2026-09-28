import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ShowToast = (text: string) => void;

const ToastContext = createContext<ShowToast>(() => {});

/** The design's toast: ink pill, bottom-centre, auto-dismisses after 2.6s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ShowToast>((t) => {
    setText(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(null), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-7 left-1/2 z-[200] -translate-x-1/2"
      >
        {text ? (
          <div className="rounded-inner bg-ink px-5 py-3 text-small font-semibold text-white shadow-popover">
            {text}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ShowToast {
  return useContext(ToastContext);
}
