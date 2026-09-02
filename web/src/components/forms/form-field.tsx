import { useId } from "react";
import type { ReactElement } from "react";
import { cloneElement } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

interface FormFieldProps {
  label: string;
  /** the single control element — id / aria wiring is injected */
  children: ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    "aria-required"?: boolean;
  }>;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

/**
 * Label + control + hint + error, wired for accessibility.
 * The control keeps ownership of its value/onChange (RHF `register` or `Controller`).
 */
export function FormField({ label, children, error, hint, required, className }: FormFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-slot="form-field">
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="text-[11.5px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-[11.5px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
