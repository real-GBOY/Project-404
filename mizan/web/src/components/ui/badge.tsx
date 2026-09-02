import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Status pill — the prototype's `pill(label, tone)` helper, verbatim:
 * `inline-flex; gap:6px; padding:4px 10px; border-radius:999px;
 *  font-size:11.5px; font-weight:700`.
 *
 * Tone names match the design's `TONES` map and the API response `tone` field —
 * `purple` is the sand/brand tone, not literally purple.
 */
export type PillTone = "green" | "amber" | "red" | "purple" | "blue" | "gray" | "teal";

const TONE: Record<PillTone, string> = {
  green: "bg-success-surface text-success",
  amber: "bg-warning-surface text-warning",
  red: "bg-danger-surface text-danger",
  purple: "bg-brandtone-surface text-brandtone",
  blue: "bg-info-surface text-info",
  gray: "bg-neutral-surface text-neutral",
  teal: "bg-teal-surface text-teal",
};

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  /** small leading dot in the tone colour */
  dot?: boolean;
}

export const Pill = forwardRef<HTMLSpanElement, PillProps>(function Pill(
  { className, tone = "gray", dot, children, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      data-slot="pill"
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-1 text-[11.5px] font-bold",
        TONE[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="size-1.5 flex-none rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
});

/**
 * Back-compat alias. Older call sites pass semantic tone names
 * (`success` / `warning` / `danger` / `info` / `neutral` / `brand`); map them.
 */
export type BadgeTone =
  | PillTone
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "brand";

const ALIAS: Record<string, PillTone> = {
  success: "green",
  warning: "amber",
  danger: "red",
  info: "blue",
  neutral: "gray",
  brand: "purple",
};

export interface BadgeProps extends Omit<PillProps, "tone"> {
  tone?: BadgeTone;
  /** kept for source compat; the design has a single pill size */
  size?: "sm" | "md";
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = "gray", size: _size, ...props },
  ref,
) {
  const mapped = (ALIAS[tone] ?? tone) as PillTone;
  return <Pill ref={ref} tone={mapped} {...props} />;
});
