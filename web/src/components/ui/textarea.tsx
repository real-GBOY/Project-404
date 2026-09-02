import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, "aria-invalid": ariaInvalid, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      data-slot="textarea"
      aria-invalid={ariaInvalid ?? invalid ?? undefined}
      className={cn(
        "w-full rounded-md border border-border-control bg-surface px-3 py-2 text-[13px] text-foreground",
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
