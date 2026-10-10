import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

interface Shared {
  label: ReactNode;
  hint?: ReactNode;
  /** Error message; the control gets aria-invalid and aria-describedby pointing at it. */
  error?: string | null;
  /** Stable id: the form's error summary links to it. */
  fieldId?: string;
}

const BASE = "w-full rounded-sm bg-surface text-ink text-base";
const stateCls = (error?: string | null) =>
  error
    ? "border-2 border-bad-solid px-[13px]"
    : "border border-rule-strong px-3.5 focus:border-2 focus:border-ink focus:px-[13px]";

function Wrap({ id, label, hint, error, children }: Shared & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <span id={`${id}-msg`} className="text-xs text-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-msg`} className="text-xs font-medium text-bad-solid">
          <span aria-hidden="true">✕ </span>
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  fieldId,
  className = "",
  mono,
  ...rest
}: Shared & InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  const auto = useId();
  const id = fieldId ?? auto;
  return (
    <Wrap id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={`${BASE} h-12 ${mono ? "font-mono text-[15px]" : ""} ${stateCls(error)} ${className}`}
        {...rest}
      />
    </Wrap>
  );
}

export function SelectField({
  label,
  hint,
  error,
  fieldId,
  children,
  className = "",
  ...rest
}: Shared & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const id = fieldId ?? auto;
  return (
    <Wrap id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={`${BASE} h-12 text-[15px] ${stateCls(error)} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </Wrap>
  );
}

export function TextArea({
  label,
  hint,
  error,
  fieldId,
  className = "",
  ...rest
}: Shared & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const id = fieldId ?? auto;
  return (
    <Wrap id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={`${BASE} min-h-24 py-2.5 text-[15px] leading-relaxed ${stateCls(error)} ${className}`}
        {...rest}
      />
    </Wrap>
  );
}

/** On submit errors focus lands here: one link per problem, each jumping to its field. */
export function ErrorSummary({
  errors,
  focusRef,
}: {
  errors: { id: string; message: string }[];
  focusRef?: Ref<HTMLDivElement>;
}) {
  if (!errors.length) return null;
  return (
    <div
      ref={focusRef}
      tabIndex={-1}
      role="alert"
      className="rounded-sm border border-bad-line bg-bad-bg p-4 text-sm text-bad-ink"
    >
      <strong className="block">
        Please fix {errors.length === 1 ? "this" : "these"} before continuing:
      </strong>
      <ul className="mt-2 list-disc pl-5">
        {errors.map((e) => (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              className="text-bad-ink"
              onClick={(ev) => {
                ev.preventDefault();
                document.getElementById(e.id)?.focus();
              }}
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
