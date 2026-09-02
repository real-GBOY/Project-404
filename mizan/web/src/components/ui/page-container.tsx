import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Standard content padding + max width for a routed page inside the shell. */
export function PageContainer({
  children,
  className,
  width = "wide",
}: {
  children: ReactNode;
  className?: string;
  width?: "wide" | "narrow";
}) {
  return (
    <div
      className={cn(
        "mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6",
        width === "wide" ? "max-w-7xl" : "max-w-3xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
