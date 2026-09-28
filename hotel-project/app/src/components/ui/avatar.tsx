import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";

const SIZES = {
  sm: "size-8 text-small",
  md: "size-10 text-body",
  lg: "size-14 text-[20px]",
} as const;

/** Initials disc in primary-soft, as used for guests and staff throughout the design. */
export function Avatar({
  name,
  size = "md",
}: {
  name: string | null | undefined;
  size?: keyof typeof SIZES;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary-strong",
        SIZES[size],
      )}
    >
      {initials(name)}
    </div>
  );
}
