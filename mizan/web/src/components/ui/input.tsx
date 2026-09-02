import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** visual invalid state — also set `aria-invalid` for AT */
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, "aria-invalid": ariaInvalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      data-slot="input"
      aria-invalid={ariaInvalid ?? invalid ?? undefined}
      className={cn(
        "h-9 w-full rounded-md border border-border-control bg-surface px-3 text-[13px] text-foreground",
        "placeholder:text-subtle",
        "focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-danger aria-[invalid=true]:outline-danger",
        className,
      )}
      {...props}
    />
  );
});
