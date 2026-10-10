import { useEffect, useId, useRef, type ReactNode } from "react";

/** Modal dialog: focus moves in, Tab stays inside, Escape and the backdrop close it, focus returns to what opened it. */
export function Dialog({ open, onClose, title, children, width = 460 }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () =>
      Array.from(node?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter((el) => !el.hasAttribute("disabled"));
    (focusables()[0] ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} tabIndex={-1} className="flex max-h-full w-full flex-col overflow-auto rounded-lg bg-surface shadow-float" style={{ maxWidth: width }}>
        {title ? (
          <h2 id={titleId} className="px-[22px] pt-[22px] text-xl font-semibold">
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </div>
  );
}
