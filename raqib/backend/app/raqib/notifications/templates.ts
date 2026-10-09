import type { TemplateSeed } from "@core/notifications/infrastructure/template-repository.js";

/**
 * Raqib in-app notification templates, rendered by Core per recipient locale (Arabic and English). They carry
 * references and places only — never inspection content, and never anything from the confidential area.
 */
const t = (key: string, ar: [string, string], en: [string, string]): TemplateSeed[] => [
  { key, locale: "ar", channel: "in_app", subject: ar[0], body: ar[1] },
  { key, locale: "en", channel: "in_app", subject: en[0], body: en[1] },
];

const email = (key: string, ar: [string, string], en: [string, string]): TemplateSeed[] => [
  { key, locale: "ar", channel: "email", subject: ar[0], body: ar[1] },
  { key, locale: "en", channel: "email", subject: en[0], body: en[1] },
];

export const RAQIB_TEMPLATES: TemplateSeed[] = [
  ...t("raqib.visit_assigned", ["زيارة جديدة مسندة إليك: {{ref}}", "{{site}} — {{when}}"], ["New visit assigned: {{ref}}", "{{site}} — {{when}}"]),
  ...t("raqib.visit_rescheduled", ["تغيير موعد {{ref}}", "{{site}} — الموعد الجديد {{when}}"], ["{{ref}} rescheduled", "{{site}} — now {{when}}"]),
  ...t(
    "raqib.visit_unassigned",
    ["أُسندت {{ref}} إلى مفتش آخر", "{{site}} — لم تعد مسندة إليك"],
    ["{{ref}} reassigned", "{{site}} — no longer assigned to you"],
  ),
  ...t("raqib.visit_cancelled", ["أُلغيت الزيارة {{ref}}", "{{site}} — {{reason}}"], ["{{ref}} cancelled", "{{site}} — {{reason}}"]),
  ...t("raqib.visit_overdue", ["زيارة متأخرة: {{ref}}", "{{site}} — كانت مجدولة {{when}}"], ["Visit overdue: {{ref}}", "{{site}} — was scheduled {{when}}"]),
  ...t("raqib.inspection_submitted", ["{{ref}} بانتظار المراجعة", "{{site}} — بواسطة {{actor}}"], ["{{ref}} submitted for review", "{{site}} — by {{actor}}"]),
  ...t(
    "raqib.inspection_resubmitted",
    ["أُعيد إرسال {{ref}} للمراجعة", "{{site}} — بواسطة {{actor}}"],
    ["{{ref}} resubmitted for review", "{{site}} — by {{actor}}"],
  ),
  ...t(
    "raqib.inspection_forwarded",
    ["{{ref}} بانتظار اعتمادك", "{{site}} — روجع بواسطة {{actor}}"],
    ["{{ref}} awaiting your approval", "{{site}} — reviewed by {{actor}}"],
  ),
  ...t("raqib.inspection_returned", ["أُعيد التفتيش {{ref}} للاستكمال", "{{reason}}"], ["{{ref}} returned for completion", "{{reason}}"]),
  ...t("raqib.inspection_rejected", ["رُفض التفتيش {{ref}}", "{{reason}}"], ["{{ref}} rejected", "{{reason}}"]),
  ...t(
    "raqib.inspection_approved",
    ["اعتُمد التفتيش {{ref}}", "{{site}} — اعتمده {{actor}} · التقرير متاح"],
    ["{{ref}} approved", "{{site}} — approved by {{actor}} · report available"],
  ),
  ...t("raqib.action_assigned", ["إجراء تصحيحي جديد: {{ref}}", "{{title}} — الموعد {{due}}"], ["New corrective action: {{ref}}", "{{title}} — due {{due}}"]),
  ...t(
    "raqib.action_submitted",
    ["{{ref}} بانتظار مراجعة الجودة", "{{title}} — سلّمه {{actor}}"],
    ["{{ref}} awaiting quality review", "{{title}} — handed over by {{actor}}"],
  ),
  ...t("raqib.action_returned", ["أُعيد الإجراء {{ref}}", "{{reason}}"], ["{{ref}} returned", "{{reason}}"]),
  ...t("raqib.action_closed", ["أُغلق الإجراء {{ref}}", "{{title}} — أغلقه {{actor}}"], ["{{ref}} closed", "{{title}} — closed by {{actor}}"]),
  ...t("raqib.action_overdue", ["إجراء متأخر: {{ref}}", "{{title}} — كان موعده {{due}}"], ["Action overdue: {{ref}}", "{{title}} — was due {{due}}"]),
  ...t(
    "raqib.action_escalated",
    ["تصعيد: الإجراء {{ref}} لم يُحل منذ {{days}} أيام", "{{title}} — المستوى {{level}}"],
    ["Escalation: action {{ref}} unresolved for {{days}} days", "{{title}} — level {{level}}"],
  ),
  ...t("raqib.observation_high", ["ملاحظة عالية الخطورة {{ref}}", "{{title}} — {{site}}"], ["High-severity observation {{ref}}", "{{title}} — {{site}}"]),
  ...email(
    "raqib.action_escalated",
    [
      "تصعيد: الإجراء {{ref}} لم يُحل منذ {{days}} أيام",
      "الإجراء التصحيحي {{ref}} ({{title}}) ما زال دون حل بعد {{days}} أيام. مستوى التصعيد {{level}}. الموعد النهائي: {{due}}.",
    ],
    [
      "Escalation: action {{ref}} unresolved for {{days}} days",
      "Corrective action {{ref}} ({{title}}) is still unresolved after {{days}} days. Escalation level {{level}}. Due date: {{due}}.",
    ],
  ),
  ...email(
    "raqib.observation_high",
    ["ملاحظة عالية الخطورة {{ref}}", "سُجلت ملاحظة عالية الخطورة: {{title}} ({{site}}). المرجع {{ref}}. يرجى الاطلاع عليها فورًا."],
    ["High-severity observation {{ref}}", "A high-severity observation was recorded: {{title}} ({{site}}). Reference {{ref}}. Please review it now."],
  ),
  ...t(
    "raqib.training_requested",
    ["طلب تدريب {{ref}} بانتظار قرارك", "{{course}} — {{guard}}"],
    ["Training request {{ref}} awaiting your decision", "{{course}} — {{guard}}"],
  ),
  ...t("raqib.training_approved", ["اعتُمد طلب التدريب {{ref}}", "{{course}} — {{guard}}"], ["Training request {{ref}} approved", "{{course}} — {{guard}}"]),
  ...t("raqib.training_returned", ["أُعيد طلب التدريب {{ref}}", "{{reason}}"], ["Training request {{ref}} returned", "{{reason}}"]),
  ...t("raqib.training_rejected", ["رُفض طلب التدريب {{ref}}", "{{reason}}"], ["Training request {{ref}} rejected", "{{reason}}"]),
  ...t("raqib.training_scheduled", ["جُدول التدريب {{ref}}", "{{course}} — {{date}}"], ["Training {{ref}} scheduled", "{{course}} — {{date}}"]),
  ...t("raqib.training_completed", ["اكتمل التدريب {{ref}}", "{{course}} — {{guard}}"], ["Training {{ref}} completed", "{{course}} — {{guard}}"]),
  ...t(
    "raqib.conf_new",
    ["بلاغ سري جديد {{ref}}", "افتح المنطقة المحمية لمراجعته."],
    ["New confidential report {{ref}}", "Open the restricted area to review it."],
  ),
  ...t(
    "raqib.conf_response",
    ["ردّ على بلاغك {{ref}}", "يمكنك الاطلاع على الرد في منطقة البلاغات السرية."],
    ["A response to your report {{ref}}", "You can read it in the confidential reports area."],
  ),
];
