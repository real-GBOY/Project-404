import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  width?: number;
  children?: ReactNode;
  footer?: ReactNode;
}

/** Centered modal — elevated shadow, 5px radius, `slidein` entrance over a dark scrim. */
export function Modal({ open, onOpenChange, title, description, width = 420, children, footer }: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-40 bg-[rgba(11,11,12,.35)]"
          style={{ animation: "fadein .15s ease" }}
        />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-modal border border-border-elevated bg-surface outline-none"
          style={{ width, animation: "slidein .16s ease", boxShadow: "var(--shadow-modal)" }}
        >
          <div className="px-4 py-3.5">
            <DialogPrimitive.Title className="text-[14px] font-semibold text-foreground">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-1.5 text-[11.5px] text-secondary">
                {description}
              </DialogPrimitive.Description>
            )}
            {children}
          </div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-subtle px-4 py-2.5">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
