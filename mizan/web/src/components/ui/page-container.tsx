import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Routed-page wrapper inside the shell. The prototype's content area is
 * `padding:24px 26px 40px` with no max-width — the page fills the frame.
 */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 px-[26px] pb-10 pt-6", className)}>{children}</div>
  );
}
