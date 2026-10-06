/** One input of a data-entry dialog, ready to render: its current value, change handler and error state. */
export interface FormField {
  key: string;
  label: string;
  type: "text" | "date" | "select" | "textarea";
  val: string;
  on: (e: unknown) => void;
  bd: string;
  err: boolean;
  /** shown under the field */
  hint?: string;
  placeholder?: string;
  /** codes and numbers read left-to-right even in Arabic */
  ltr?: boolean;
  opts?: Array<{ v: string; l: string }>;
  /** two of these sit side by side */
  half?: boolean;
}
