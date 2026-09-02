import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/**
 * The monospace matter-number chip that appears in every table and detail
 * header in the prototype — `padding:3px 8px; border-radius:7px;
 * background:#F7F3EF; border:1px solid #D4B98F; color:#2E1A12;
 * font-family:monospace; font-size:11.5px; font-weight:700`.
 *
 * Also used for receipt / invoice reference numbers.
 */
export const MatterChip = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  function MatterChip({ className, children, ...props }, ref) {
    return (
      <span
        ref={ref}
        data-slot="matter-chip"
        className={cn(
          "inline-flex items-center rounded-chip border border-chip-border bg-chip px-2 py-0.5",
          "font-mono text-[11.5px] font-bold tracking-[0.01em] text-chip-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </span>
    );
  },
);
