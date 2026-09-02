import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The prototype's field pair used across every detail header and info panel:
 * uppercase label (`10.5px / 700 / 0.06em`, subtle or warm) over a `13px / 700`
 * value.
 */
export function DetailField({
  label,
  children,
  labelTone = "subtle",
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  labelTone?: "subtle" | "warm";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "mb-1 text-[10.5px] font-bold uppercase tracking-[0.06em]",
          labelTone === "warm" ? "text-warm-muted" : "text-subtle",
        )}
      >
        {label}
      </div>
      <div className="text-[13px] font-bold text-foreground">{children}</div>
    </div>
  );
}
