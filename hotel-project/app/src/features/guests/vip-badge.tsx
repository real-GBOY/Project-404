import { cn } from "@/lib/cn";

/** The design's VIP chip: 10px extra-bold on warning-soft. */
export function VipBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded-[5px] bg-warning-soft px-[7px] py-[3px] text-[10px] font-extrabold text-warning-strong",
        className,
      )}
    >
      VIP
    </span>
  );
}
