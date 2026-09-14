import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { TONE_CLASS, toneOf, type Tone } from "@/lib/tone";

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

/** A generic tone-colored pill — `padding:2px 6px; font-size:10px; font-weight:600; radius:2px`. */
export const Pill = forwardRef<HTMLSpanElement, PillProps>(function Pill(
  { className, tone = "muted", dot, children, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      data-slot="pill"
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-badge px-1.5 py-0.5 text-[10px] font-semibold",
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="size-1.5 flex-none rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
});

/** A `Pill` that resolves its tone from a raw status string via the `tone()` lookup. */
export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Pill tone={toneOf(status)} className={className}>
      {status}
    </Pill>
  );
}
