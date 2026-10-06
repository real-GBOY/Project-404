import type { Ctx } from "../../context";

/** What a dialog's confirm handler gets: the context, the dialog (`m`: its kind and the data it was opened with), the form and the reason. */
export interface ModalSubmit {
  c: Ctx;
  m: NonNullable<Ctx["ui"]["modal"]>;
  f: Ctx["ui"]["mf"];
  reason: string;
}
export type ModalHandler = (h: ModalSubmit) => Promise<void>;
export type ModalHandlers = Record<string, ModalHandler>;

/** A trimmed form value, or undefined when empty (for optional comments). */
export const optional = (v: unknown): string | undefined => String(v ?? "").trim() || undefined;

/** The reference (e.g. "VIS-26-0001") of the record a dialog was opened for, for the confirmation toast. */
export const refOf = (m: { kind: string } & Record<string, unknown>): string => String(m.ref ?? "");
