import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Modal dialog in the design's popover language (surface, 14px radius, popover shadow over a
 * warm scrim). Traps nothing fancy: focuses the first field, closes on Escape or scrim click,
 * and restores focus to the opener on close.
 */
export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("input, select, textarea, button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pt-[10vh] pb-8">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-shadow"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ maxWidth: width }}
        className="relative w-full rounded-panel border border-border bg-surface shadow-popover"
      >
        <div className="border-b border-border-subtle px-6 pt-5 pb-4">
          <h2 id={titleId} className="m-0 text-title font-bold">
            {title}
          </h2>
          {description ? <p className="m-0 mt-1 text-small text-muted">{description}</p> : null}
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2.5 border-t border-border-subtle px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
