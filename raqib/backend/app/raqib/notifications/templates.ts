import type { TemplateSeed } from "@core/notifications/infrastructure/template-repository.js";

/**
 * Raqib in-app notification templates, rendered by Core per recipient locale (Arabic and English). They carry
 * references and places only — never inspection content, and never anything from the confidential area.
 */
const t = (key: string, ar: [string, string], en: [string, string]): TemplateSeed[] => [
  { key, locale: "ar", channel: "in_app", subject: ar[0], body: ar[1] },
  { key, locale: "en", channel: "in_app", subject: en[0], body: en[1] },
];

export const RAQIB_TEMPLATES: TemplateSeed[] = [
  ...t("raqib.visit_assigned", ["زيارة جديدة مسندة إليك: {{ref}}", "{{site}} — {{when}}"], ["New visit assigned: {{ref}}", "{{site}} — {{when}}"]),
  ...t("raqib.visit_rescheduled", ["تغيير موعد {{ref}}", "{{site}} — الموعد الجديد {{when}}"], ["{{ref}} rescheduled", "{{site}} — now {{when}}"]),
  ...t("raqib.visit_unassigned", ["أُسندت {{ref}} إلى مفتش آخر", "{{site}} — لم تعد مسندة إليك"], ["{{ref}} reassigned", "{{site}} — no longer assigned to you"]),
  ...t("raqib.visit_cancelled", ["أُلغيت الزيارة {{ref}}", "{{site}} — {{reason}}"], ["{{ref}} cancelled", "{{site}} — {{reason}}"]),
  ...t("raqib.visit_overdue", ["زيارة متأخرة: {{ref}}", "{{site}} — كانت مجدولة {{when}}"], ["Visit overdue: {{ref}}", "{{site}} — was scheduled {{when}}"]),
  ...t("raqib.inspection_submitted", ["{{ref}} بانتظار المراجعة", "{{site}} — بواسطة {{actor}}"], ["{{ref}} submitted for review", "{{site}} — by {{actor}}"]),
  ...t("raqib.inspection_resubmitted", ["أُعيد إرسال {{ref}} للمراجعة", "{{site}} — بواسطة {{actor}}"], ["{{ref}} resubmitted for review", "{{site}} — by {{actor}}"]),
  ...t("raqib.inspection_forwarded", ["{{ref}} بانتظار اعتمادك", "{{site}} — روجع بواسطة {{actor}}"], ["{{ref}} awaiting your approval", "{{site}} — reviewed by {{actor}}"]),
  ...t("raqib.inspection_returned", ["أُعيد التفتيش {{ref}} للاستكمال", "{{reason}}"], ["{{ref}} returned for completion", "{{reason}}"]),
  ...t("raqib.inspection_rejected", ["رُفض التفتيش {{ref}}", "{{reason}}"], ["{{ref}} rejected", "{{reason}}"]),
  ...t("raqib.inspection_approved", ["اعتُمد التفتيش {{ref}}", "{{site}} — اعتمده {{actor}}"], ["{{ref}} approved", "{{site}} — approved by {{actor}}"]),
];
