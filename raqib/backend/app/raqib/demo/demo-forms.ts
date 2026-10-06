import type { FormSection } from "@raqib/raqib/forms/domain/form.js";

/**
 * The demo inspection forms (from the approved design): the core site form with its version history, the guard
 * evaluation form, a healthcare add-on and a draft logistics form. Item keys stay stable across versions so the
 * version diff is meaningful.
 */
const T = (ar: string, en: string) => ({ ar, en });
const item = (key: string, ar: string, en: string, weight: number, over: Partial<FormSection["items"][number]> = {}) => ({
  key,
  text: T(ar, en),
  weight,
  type: "cnx" as const,
  required: true,
  na: true,
  evidenceOnNc: true,
  ...over,
});

const clone = <X>(x: X): X => JSON.parse(JSON.stringify(x)) as X;

/** Core site inspection form — version 2.1 (the published one). */
export const CORE_V21: FormSection[] = [
  {
    key: "a",
    title: T("ضبط الدخول والخروج", "Access control"),
    items: [
      item("q1", "سجل الزوار محدّث ومكتمل البيانات", "Visitor log is maintained and complete", 3),
      item("q2", "التحقق من هوية الزوار عند البوابة", "Visitor ID is verified at the gate", 3),
      item("q3", "تفتيش المركبات وفق الإجراء المعتمد", "Vehicles are inspected per approved procedure", 2),
      item("q4", "بطاقات التعريف ظاهرة على جميع العاملين", "ID badges are visible on all staff", 1),
    ],
  },
  {
    key: "b",
    title: T("المراقبة التلفزيونية", "CCTV & monitoring"),
    items: [
      item("q5", "جميع الكاميرات تعمل وتغطي المناطق المحددة", "All cameras operational and covering assigned zones", 3),
      item("q6", "غرفة التحكم مشغولة على مدار الوردية", "Control room staffed for the full shift", 3),
      item("q7", "الاحتفاظ بالتسجيلات لمدة 90 يومًا", "Recordings retained for 90 days", 2),
    ],
  },
  {
    key: "c",
    title: T("الدوريات", "Patrols"),
    items: [
      item("q8", "الالتزام بجدول الدوريات", "Patrol schedule is followed", 2),
      item("q9", "مسح جميع نقاط التفتيش إلكترونيًا", "All checkpoints scanned electronically", 2),
      item("q10", "سجل الدوريات موقّع من المشرف", "Patrol log signed by supervisor", 1),
    ],
  },
  {
    key: "d",
    title: T("الجاهزية للطوارئ", "Emergency readiness"),
    items: [
      item("q11", "طفايات الحريق مفحوصة وسارية الصلاحية", "Fire extinguishers inspected and in date", 3),
      item("q12", "مخارج الطوارئ خالية من العوائق", "Emergency exits are unobstructed", 3),
      item("q13", "خطة الإخلاء معلقة في المواقع المحددة", "Evacuation plan posted at designated points", 1),
    ],
  },
  {
    key: "e",
    title: T("التوثيق والسجلات", "Documentation"),
    items: [
      item("q14", "تعليمات الموقع متوفرة في نقطة الحراسة", "Post orders available at the post", 2),
      item("q15", "تسليم الوردية موثق في السجل", "Shift handover recorded in the log", 2),
      item("q16", "سجل الحوادث محدّث", "Incident register is up to date", 2),
    ],
  },
];

export const CORE_V20: FormSection[] = (() => {
  const v = clone(CORE_V21);
  v[0]!.items = v[0]!.items.filter((i) => i.key !== "q4");
  v[4]!.items = v[4]!.items.filter((i) => i.key !== "q16");
  v[3]!.items[2]!.weight = 2;
  return v;
})();
export const CORE_V14: FormSection[] = (() => {
  const v = clone(CORE_V20);
  v.pop();
  return v;
})();
export const CORE_V22: FormSection[] = (() => {
  const v = clone(CORE_V21);
  v[2]!.items.push(item("q17", "اختبار أجهزة الاتصال اللاسلكي في بداية الوردية", "Radios tested at start of shift", 2, { na: false }));
  v[2]!.items[1]!.weight = 3;
  return v;
})();

export const GUARD_V13: FormSection[] = [
  {
    key: "g",
    title: T("معايير التقييم", "Evaluation criteria"),
    items: [
      ["gc0", "المظهر والزي", "Appearance & uniform"],
      ["gc1", "اليقظة والانتباه", "Alertness"],
      ["gc2", "معرفة تعليمات الموقع", "Knowledge of post orders"],
      ["gc3", "جاهزية المعدات", "Equipment readiness"],
      ["gc4", "التواصل والسلوك", "Conduct & communication"],
    ].map(([k, ar, en]) => item(k!, ar!, en!, 1, { type: "scale5", na: false, evidenceOnNc: false })),
  },
];

export const HEALTH_V10: FormSection[] = [
  {
    key: "h1",
    title: T("المداخل والاستقبال", "Entrances & reception"),
    items: [
      item("hq1", "ضبط دخول الزوار خارج أوقات الزيارة", "Visitor control outside visiting hours", 3),
      item("hq2", "أساور التعريف للمرضى في الأقسام المغلقة", "Patient ID bands in secured wards", 2),
    ],
  },
  {
    key: "h2",
    title: T("المناطق الحساسة", "Sensitive areas"),
    items: [
      item("hq3", "الصيدلية المركزية مقفلة ومراقبة", "Central pharmacy locked and monitored", 3),
      item("hq4", "سجل دخول مخزن الأدوية المراقبة", "Controlled-drug store access log", 3),
      item("hq5", "حراسة جناح الأطفال حديثي الولادة", "Neonatal ward guarding", 3),
    ],
  },
  {
    key: "h3",
    title: T("الطوارئ", "Emergency"),
    items: [
      item("hq6", "مسار سيارات الإسعاف خالٍ", "Ambulance lane clear", 2),
      item("hq7", "إجراء التعامل مع المراجع العدواني معروف للحراس", "Aggressive-visitor procedure known to guards", 2),
    ],
  },
];

export const YARD_V01: FormSection[] = [
  {
    key: "y1",
    title: T("السور والإنارة", "Fencing & lighting"),
    items: [
      item("yq1", "سلامة السور المحيطي", "Perimeter fence intact", 3),
      item("yq2", "عدد الأعمدة المعطلة", "Number of failed light poles", 1, { type: "number", na: false, evidenceOnNc: false }),
    ],
  },
];

export interface DemoForm {
  code: string;
  category: "site" | "guard";
  name: { ar: string; en: string };
  description: { ar: string; en: string };
  active: boolean;
  isDefault: boolean;
  versions: Array<{ version: string; status: "draft" | "published" | "archived"; sections: FormSection[]; note: { ar: string; en: string } }>;
}

export const DEMO_FORMS: DemoForm[] = [
  {
    code: "FRM-SEC-01",
    category: "site",
    name: T("نموذج تفتيش المواقع الأمنية", "Security Site Inspection Form"),
    active: true,
    isDefault: true,
    description: T("النموذج الأساسي لتفتيش المواقع الأمنية في جميع المشاريع.", "Core security site inspection used on all projects."),
    versions: [
      { version: "1.4", status: "archived", sections: CORE_V14, note: T("الإصدار الأولي المعتمد", "Initial approved release") },
      { version: "2.0", status: "archived", sections: CORE_V20, note: T("إضافة قسم التوثيق والسجلات", "Added documentation section") },
      {
        version: "2.1",
        status: "published",
        sections: CORE_V21,
        note: T(
          "إضافة بندي بطاقات التعريف وسجل الحوادث، ورفع وزن خطة الإخلاء إلى 1",
          "Added ID badges and incident register items; evacuation plan weight set to 1",
        ),
      },
      {
        version: "2.2",
        status: "draft",
        sections: CORE_V22,
        note: T("إضافة اختبار اللاسلكي، ورفع وزن مسح نقاط التفتيش إلى 3", "Added radio test; checkpoint scan weight raised to 3"),
      },
    ],
  },
  {
    code: "FRM-GRD-02",
    category: "guard",
    name: T("نموذج تقييم الحراس", "Guard Evaluation Form"),
    active: true,
    isDefault: true,
    description: T("يُستخدم داخل الزيارة لتقييم كل حارس بشكل مستقل.", "Used within a visit to evaluate each guard independently."),
    versions: [{ version: "1.3", status: "published", sections: GUARD_V13, note: T("مقياس من 1 إلى 5 لكل معيار", "1–5 scale per criterion") }],
  },
  {
    code: "FRM-HSP-01",
    category: "site",
    name: T("تفتيش أمن المنشآت الصحية", "Healthcare Facility Security Inspection"),
    active: true,
    isDefault: false,
    description: T("بنود إضافية للمستشفيات تُستخدم مع النموذج الأساسي.", "Additional hospital items used alongside the core form."),
    versions: [{ version: "1.0", status: "published", sections: HEALTH_V10, note: T("الإصدار الأولي", "Initial release") }],
  },
  {
    code: "FRM-LOG-01",
    category: "site",
    name: T("تفتيش المستودعات والساحات", "Warehouse & Yard Inspection"),
    active: false,
    isDefault: false,
    description: T("قيد الإعداد لمركز جدة اللوجستي.", "Being prepared for Jeddah Logistics Hub."),
    versions: [{ version: "0.1", status: "draft", sections: YARD_V01, note: T("مسودة أولية", "First draft") }],
  },
];
