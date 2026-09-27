import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Labelled input in the design's form style (12px muted label, 8px-radius canvas field). */
export function TextField({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-label font-semibold text-muted">
        {label}
      </label>
      <input
        id={id}
        className="rounded-control border border-border bg-canvas px-3.5 py-3 text-body font-semibold text-ink outline-none placeholder:font-normal placeholder:text-faint focus:border-primary"
        {...props}
      />
    </div>
  );
}
