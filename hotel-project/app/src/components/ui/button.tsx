import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary";
type Size = "md" | "sm";

const VARIANTS: Record<Variant, string> = {
  primary: "border border-transparent bg-primary text-white hover:bg-primary-strong",
  secondary: "border border-border bg-surface text-ink hover:bg-canvas",
};

const SIZES: Record<Size, string> = {
  md: "px-[18px] py-[11px] text-body rounded-button",
  sm: "px-4 py-[10px] text-small rounded-control",
};

/** The design's two button treatments: solid indigo primary and bordered surface secondary. */
export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={cn(
        "cursor-pointer font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
