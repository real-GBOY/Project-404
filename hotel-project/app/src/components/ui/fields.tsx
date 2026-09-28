import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "rounded-control border border-border bg-canvas px-3.5 py-2.5 text-body text-ink outline-none placeholder:text-faint focus:border-primary disabled:opacity-60";

function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-label font-semibold text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <span id={`${id}-error`} className="text-label font-semibold text-danger">
          {error}
        </span>
      ) : hint ? (
        <span className="text-label text-faint">{hint}</span>
      ) : null}
    </div>
  );
}

export function InputField({
  label,
  error,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} hint={hint} className={className}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(CONTROL, error && "border-danger")}
        {...props}
      />
    </Field>
  );
}

export function SelectField({
  label,
  error,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} className={className}>
      <select id={id} className={cn(CONTROL, "cursor-pointer")} {...props}>
        {children}
      </select>
    </Field>
  );
}

export function TextAreaField({
  label,
  error,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} className={className}>
      <textarea id={id} rows={3} className={cn(CONTROL, "resize-y")} {...props} />
    </Field>
  );
}

export function CheckboxField({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn("flex cursor-pointer items-center gap-2 text-small font-semibold", className)}
    >
      <input id={id} type="checkbox" className="size-4 accent-primary" {...props} />
      {label}
    </label>
  );
}

/** A form-level error banner (danger-soft), e.g. for a 409 from the server. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-control bg-danger-soft px-3.5 py-2.5 text-small font-semibold text-danger"
    >
      {message}
    </div>
  );
}
