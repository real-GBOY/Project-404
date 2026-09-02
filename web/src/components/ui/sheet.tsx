import { forwardRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

/** A slide-in panel. Side is logical: `end` = trailing edge (right in LTR). */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const Overlay = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function Overlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn("fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[1px]", className)}
      {...props}
    />
  );
});

type Side = "start" | "end" | "bottom";

export const SheetContent = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: Side }
>(function SheetContent({ className, children, side = "end", ...props }, ref) {
  const { t } = useTranslation("common");
  const position = {
    start: "inset-y-0 start-0 h-full w-[min(26rem,100vw-2rem)] border-e",
    end: "inset-y-0 end-0 h-full w-[min(26rem,100vw-2rem)] border-s",
    bottom: "inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-xl border-t",
  }[side];

  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        ref={ref}
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col border-border bg-surface shadow-sheet outline-none",
          position,
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={t("actions.cancel")}
          className="absolute end-3 top-3 flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-subtle hover:text-foreground"
        >
          <Icon name="close" size={17} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1 border-b border-divider px-5 py-4 pe-10", className)}
      {...props}
    />
  );
}

export function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto px-5 py-4", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2 border-t border-divider px-5 py-4", className)}
      {...props}
    />
  );
}

export const SheetTitle = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function SheetTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-[15px] font-bold tracking-tight text-foreground", className)}
      {...props}
    />
  );
});

export const SheetDescription = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function SheetDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-[13px] text-muted", className)}
      {...props}
    />
  );
});
