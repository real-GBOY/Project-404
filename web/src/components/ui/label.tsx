import { forwardRef } from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/cn";

/** Form label. Associates via `htmlFor`; clicking focuses the control. */
export const Label = forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      data-slot="label"
      className={cn(
        "inline-flex items-center gap-1 text-[12.5px] font-semibold text-foreground-body select-none",
        className,
      )}
      {...props}
    />
  );
});
