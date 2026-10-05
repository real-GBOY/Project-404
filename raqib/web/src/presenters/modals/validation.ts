/** Dialogs that need a stated reason (the approved design records who changed what, and why). */
export const NEED_REASON = new Set([
  "reqReject",
  "reveal",
  "revoke",
  "grantAdd",
  "trReturn",
  "trReject",
  "caReturn",
  "return",
  "reject",
  "publish",
  "deactivateForm",
  "create",
  "resched",
  "cancel",
  "roleChange",
  "userScope",
  "userDisable",
  "userEnable",
  "permSave",
  "scopeSave",
  "settingsSave",
]);

/** The fields a dialog cannot be confirmed without (besides the reason, which `NEED_REASON` covers). */
const REQUIRED: Record<string, string[]> = {
  create: ["p", "s", "date", "time"],
  resched: ["date", "time"],
  ca: ["title", "resp", "due"],
  tr: ["g", "course"],
  trSchedule: ["date", "provider"],
  trComplete: ["date"],
  reqApprove: ["role"],
  grantAdd: ["guser", "expires"],
  newSection: ["title"],
  roleChange: ["role"],
};

/** Which required fields are empty. Local validation is UX only: the backend stays the authority and may still refuse. */
export function missingFields(kind: string, form: Record<string, unknown>): string[] {
  const missing = (REQUIRED[kind] ?? []).filter((k) => !String(form[k] ?? "").trim());
  if (NEED_REASON.has(kind) && String(form.reason ?? "").trim().length < 3)
    missing.unshift("reason");
  return missing;
}
