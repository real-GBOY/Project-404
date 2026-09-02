import { Icon } from "./icon";
import { cn } from "@/lib/cn";

/** Indeterminate activity indicator. Decorative — pair with visible/SR text. */
export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <Icon name="progress_activity" size={size} className={cn("animate-spin", className)} />;
}
