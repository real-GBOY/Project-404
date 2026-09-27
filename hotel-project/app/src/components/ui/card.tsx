import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The design's panel: surface fill, 1px border, 12px radius, 20px padding. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-card border border-border bg-surface p-5", className)} {...props} />
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("m-0 mb-3.5 text-body font-bold", className)}>{children}</h2>;
}
