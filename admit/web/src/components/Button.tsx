import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ink" | "secondary" | "danger" | "text";
type Size = "lg" | "md" | "sm";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-deep active:bg-brand-press active:translate-y-px",
  ink: "bg-ink text-paper hover:bg-ink-3 active:translate-y-px",
  secondary: "bg-transparent text-ink border border-ink hover:bg-ink hover:text-paper",
  danger: "bg-surface text-bad-solid border border-[#e7b4ae] hover:bg-bad-bg",
  text: "bg-transparent text-ink underline decoration-brand underline-offset-4 px-1",
};
const SIZE: Record<Size, string> = {
  lg: "h-12 px-5 text-[15px]",
  md: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-xs",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

/** 48 / 40 / 32 high. `loading` disables the button and announces it busy (aria-busy), keeping its label. */
export function Button({
  variant = "primary",
  size = "lg",
  loading,
  block,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const off = disabled || loading;
  return (
    <button
      type={type}
      disabled={off}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-sm font-semibold transition-colors duration-100 disabled:border-transparent disabled:bg-rule disabled:text-faint disabled:hover:bg-rule disabled:hover:text-faint ${variant === "text" ? "" : SIZE[size]} ${VARIANT[variant]} ${block ? "w-full" : ""} ${loading ? "opacity-85" : ""} ${className}`}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="spin inline-block size-3.5 rounded-full border-2 border-white/40 border-t-white"
        />
      ) : null}
      {children}
    </button>
  );
}
