import type { I18n } from "@/i18n/i18n";

/** The record types the audit trail names. Anything else is shown as the backend sent it. */
const ENTITIES = new Set([
  "file",
  "raqib_account_request",
  "raqib_action",
  "raqib_area",
  "raqib_evidence",
  "raqib_form",
  "raqib_guard",
  "raqib_inspection",
  "raqib_observation",
  "raqib_project",
  "raqib_report",
  "raqib_role_template",
  "raqib_settings",
  "raqib_site",
  "raqib_training",
  "raqib_user",
  "raqib_visit",
  "user",
]);

/** "raqib_corrective_action" style record types as words a person reads ("Corrective action"). */
export const entityLabel = (i: I18n, entity: string): string =>
  ENTITIES.has(entity) ? i.S(`aent_${entity}`) : entity;

/** "raqib.evidence.attached" → "Evidence attached", "user.logged_in" → "User logged in". The export keeps the exact codes. */
export function actionLabel(action: string): string {
  const words = action
    .replace(/^raqib\./, "")
    .split(".")
    .join(" ")
    .replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Fields that identify the tenant or the row itself say nothing to the reader of a change. */
const NOISE = new Set(["organizationId", "organization_id", "id"]);

const words = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();

const scalar = (v: unknown): string =>
  v !== null && typeof v === "object" ? JSON.stringify(v) : String(v);

/** A before/after snapshot as "field: value · field: value" instead of a JSON blob, without the tenant id. */
export function changeText(v: unknown, max = 220): string {
  if (v == null) return "";
  let text: string;
  if (typeof v === "object" && !Array.isArray(v)) {
    text = Object.entries(v as Record<string, unknown>)
      .filter(([k, val]) => !NOISE.has(k) && val !== undefined)
      .map(([k, val]) => `${words(k)}: ${scalar(val)}`)
      .join(" · ");
  } else text = scalar(v);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
