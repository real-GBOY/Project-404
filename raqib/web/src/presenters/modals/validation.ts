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
  "userMfaReset",
  "caReassign",
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
  projNew: ["code", "nameAr", "nameEn"],
  projEdit: ["nameAr", "nameEn"],
  siteAdd: ["nameAr", "nameEn"],
  siteRename: ["nameAr", "nameEn"],
  areaAdd: ["nameAr", "nameEn"],
  guardNew: ["gproj", "emp", "nid", "nameAr", "nameEn"],
  guardEdit: ["gproj", "nameAr", "nameEn"],
  formNew: ["fcode", "nameAr", "nameEn"],
  formRename: ["nameAr", "nameEn"],
  obsNew: ["oproj", "osite", "otext"],
  userEdit: ["nameAr", "nameEn"],
  caReassign: ["resp", "due"],
};

/** Shapes the backend would refuse anyway; checking them here just saves the round trip. An empty optional value passes. */
const SHAPES: Record<string, { field: string; ok: (v: string) => boolean }[]> = {
  formNew: [{ field: "fcode", ok: (v) => /^[A-Za-z0-9-]{3,24}$/.test(v) }],
  projNew: [{ field: "code", ok: (v) => /^[A-Za-z0-9-]{3,24}$/.test(v) }],
  guardNew: [{ field: "nid", ok: (v) => /^[0-9]{10}$/.test(v) }],
  guardEdit: [{ field: "nid", ok: (v) => !v || /^[0-9]{10}$/.test(v) }],
};

/** Which required fields are empty. Local validation is UX only: the backend stays the authority and may still refuse. */
export function missingFields(kind: string, form: Record<string, unknown>): string[] {
  const missing = (REQUIRED[kind] ?? []).filter((k) => !String(form[k] ?? "").trim());
  for (const s of SHAPES[kind] ?? []) {
    const v = String(form[s.field] ?? "").trim();
    if (!missing.includes(s.field) && !s.ok(v)) missing.push(s.field);
  }
  if (NEED_REASON.has(kind) && String(form.reason ?? "").trim().length < 3)
    missing.unshift("reason");
  return missing;
}
