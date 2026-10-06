import type { ComponentProps, ReactNode } from "react";
import { FORM } from "@/styles/form-styles";

/** A labelled control with an optional hint underneath. The label wraps the control, so it is read with it. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label style={FORM.label}>
      {label}
      {children}
      {hint ? <span style={FORM.hint}>{hint}</span> : null}
    </label>
  );
}

/** A text box in the form style; Latin-script values (e-mail, passwords, codes) are laid out left-to-right. */
export function TextInput({ style, ...rest }: ComponentProps<"input">) {
  return <input dir="ltr" {...rest} style={{ ...FORM.input, ...style }} />;
}
