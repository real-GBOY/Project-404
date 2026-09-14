import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";
import { IconButton } from "./icon-button";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}

/** Right-side slide-over — unit detail, notifications. Design width 520px/372px,
 *  directional shadow, `fadein` scrim + `slidein` panel entrance. */
export function Drawer({ open, onOpenChange, title, width = 480, children, footer }: DrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-40 bg-[rgba(11,11,12,.28)]"
          style={{ animation: "fadein .15s ease" }}
        />
        <DialogPrimitive.Content
          className="fixed inset-y-0 right-0 z-50 flex max-w-[96vw] flex-col border-l border-border bg-surface outline-none"
          style={{ width, animation: "slidein .18s ease", boxShadow: "var(--shadow-drawer)" }}
        >
          <div className="flex flex-none items-center gap-2 border-b border-border px-4 py-3">
            <DialogPrimitive.Title className="flex-1 truncate text-[13px] font-semibold text-foreground">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton icon="close" aria-label="Close" size={13} />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
          {footer && (
            <div className="flex flex-none items-center gap-2 border-t border-border bg-surface-subtle px-4 py-2.5">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function DrawerSection({
  title,
  className,
  children,
}: {
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("border-b border-border-row px-4 py-3.5 last:border-0", className)}>
      {title && (
        <div className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</div>
      )}
      {children}
    </div>
  );
}
