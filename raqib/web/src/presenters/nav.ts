import type { Me, ModuleKey, RoleKey } from "@/api/types";
import type { L10n } from "@/api/types";

/**
 * Navigation is UX: which entries a role is OFFERED. The backend enforces every route regardless.
 * An entry only appears when its backend phase exists (`ENABLED_NAV`) and the person's permission
 * template grants its module.
 */
export const NAV_META: Record<string, { g: string; l: L10n }> = {
  overview: { g: "ops", l: { ar: "نظرة عامة", en: "Overview" } },
  projects: { g: "ops", l: { ar: "المشاريع", en: "Projects" } },
  visits: { g: "ops", l: { ar: "جدول الزيارات", en: "Visit schedule" } },
  reviews: { g: "ops", l: { ar: "المراجعة والاعتماد", en: "Review & approval" } },
  inspections: { g: "ops", l: { ar: "تفتيشاتي", en: "My inspections" } },
  observations: { g: "ops", l: { ar: "الملاحظات والمخالفات", en: "Observations & violations" } },
  actions: { g: "ops", l: { ar: "الإجراءات التصحيحية", en: "Corrective actions" } },
  guards: { g: "people", l: { ar: "الحراس", en: "Guards" } },
  training: { g: "people", l: { ar: "طلبات التدريب", en: "Training requests" } },
  reports: { g: "insight", l: { ar: "التقارير", en: "Reports" } },
  analytics: { g: "insight", l: { ar: "التحليلات", en: "Analytics" } },
  forms: { g: "admin", l: { ar: "نماذج التفتيش", en: "Inspection forms" } },
  users: { g: "admin", l: { ar: "المستخدمون", en: "Users" } },
  permissions: { g: "admin", l: { ar: "قوالب الصلاحيات", en: "Permission templates" } },
  audit: { g: "admin", l: { ar: "سجل التدقيق", en: "Audit log" } },
  settings: { g: "admin", l: { ar: "الإعدادات", en: "Settings" } },
  confidential: { g: "restricted", l: { ar: "البلاغات السرية", en: "Confidential reports" } },
};

export const NAV_GROUPS: Record<string, L10n> = {
  ops: { ar: "العمليات", en: "Operations" },
  people: { ar: "الأفراد", en: "People" },
  insight: { ar: "التقارير والتحليل", en: "Insight" },
  admin: { ar: "الإدارة", en: "Administration" },
  restricted: { ar: "منطقة مقيدة", en: "Restricted" },
};

/** Display order per role. */
export const ROLE_NAV: Record<RoleKey, string[]> = {
  qm: ["overview", "projects", "visits", "reviews", "observations", "actions", "guards", "training", "reports", "analytics", "forms", "users", "permissions", "audit", "settings", "confidential"],
  qe: ["overview", "projects", "visits", "reviews", "observations", "actions", "guards", "training", "reports", "analytics", "forms"],
  pm: ["overview", "projects", "observations", "actions", "training", "reports", "analytics"],
  ins: ["overview", "visits", "inspections"],
  gs: ["overview", "guards", "observations", "training"],
  guard: ["overview", "confidential"],
  gm: ["overview", "analytics", "reports", "audit", "confidential"],
};

/** Nav entry → the template module that must grant View. */
const MODULE_OF_NAV: Record<string, ModuleKey> = {
  projects: "projects", visits: "visits", reviews: "inspections", inspections: "inspections", observations: "observations",
  actions: "actions", guards: "guardEval", training: "training", reports: "reports", analytics: "analytics",
  forms: "forms", users: "users", permissions: "permissions", audit: "audit", settings: "settings",
};

/** Entries whose backend exists in this build. Grows phase by phase (see raqib/docs/architecture.md §9). */
export const ENABLED_NAV: ReadonlySet<string> = new Set(["overview", "projects", "visits", "reviews", "inspections", "forms", "guards", "users", "permissions", "settings"]);

export function visibleNav(me: Me): string[] {
  const t = me.permissions;
  return ROLE_NAV[me.role].filter((k) => {
    if (!ENABLED_NAV.has(k)) return false;
    if (k === "overview" || k === "confidential") return true;
    if (k === "reviews") return t.inspections.includes("R") || t.inspections.includes("P");
    if (k === "inspections") return t.inspections.includes("S");
    const m = MODULE_OF_NAV[k];
    return m ? t[m].includes("V") : true;
  });
}

/** Route name → the nav entry that highlights for it. */
export function navKeyOf(n: string): string {
  return ({ project: "projects", visit: "visits", inspect: "visits", review: "reviews", report: "reports", action: "actions", guard: "guards", user: "users", request: "users", form: "forms", trainingD: "training", rpt: "reports" } as Record<string, string>)[n] ?? n;
}
