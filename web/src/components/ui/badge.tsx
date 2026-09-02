import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/** Tone set — mirrors the design's `TONES` map. */
const badge = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-0.5 text-[11.5px] font-semibold",
  {
    variants: {
      tone: {
        success: "bg-success-surface text-success",
        warning: "bg-warning-surface text-warning",
        danger: "bg-danger-surface text-danger",
        info: "bg-info-surface text-info",
        neutral: "bg-neutral-surface text-neutral",
        brand: "bg-brandtone-surface text-brandtone",
        teal: "bg-teal-surface text-teal",
      },
      size: {
        sm: "px-1.5 py-px text-[10.5px]",
        md: "px-2 py-0.5 text-[11.5px]",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badge>["tone"]>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {
  /** small leading dot in the tone colour */
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, tone, size, dot, children, ...props },
  ref,
) {
  return (
    <span ref={ref} data-slot="badge" className={cn(badge({ tone, size }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
});
