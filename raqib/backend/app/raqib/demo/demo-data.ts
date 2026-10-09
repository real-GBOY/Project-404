import type { RoleKey } from "@raqib/raqib/shared/modules.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";

/**
 * The Raqib demo organization — a fictional Saudi guarding company. Names, places and references are
 * invented. Everything here is seeded through the real repositories/services (see demo-seeder.ts),
 * never by raw inserts that skip invariants. Later phases extend this dataset with visits, inspections,
 * observations and so on, in the same way.
 */
export const DEMO_ORG = { name: "Raqib Security Services Co.", slug: "raqib-demo" } as const;

/** Development/demo credential only — never used outside RAQIB_SEED_DEMO. */
export const DEMO_PASSWORD = "demo-password-2026";

const T = (ar: string, en: string): L10n => ({ ar, en });

export interface DemoPerson {
  key: string;
  email: string;
  role: RoleKey;
  name: L10n;
  title: L10n;
  employeeNo?: string;
  status?: "active" | "invited" | "disabled";
  /** Project keys the person is assigned to (ignored for roles that cover every project). */
  projects: string[];
  owner?: boolean;
}

export const DEMO_PEOPLE: DemoPerson[] = [
  {
    key: "qm",
    email: "s.alotaibi@raqib.sa",
    role: "qm",
    name: T("م. سعود العتيبي", "Eng. Saud Al-Otaibi"),
    title: T("مدير إدارة الجودة", "Director of Quality"),
    projects: [],
    owner: true,
  },
  {
    key: "qe",
    email: "n.alqahtani@raqib.sa",
    role: "qe",
    name: T("نورة القحطاني", "Noura Al-Qahtani"),
    title: T("أخصائية جودة", "Quality Specialist"),
    projects: ["p1", "p2", "p3"],
  },
  {
    key: "pm",
    email: "f.aldosari@raqib.sa",
    role: "pm",
    name: T("فهد الدوسري", "Fahad Al-Dosari"),
    title: T("مدير مشروع", "Project Manager"),
    projects: ["p1", "p4"],
  },
  {
    key: "insA",
    email: "k.alshehri@raqib.sa",
    role: "ins",
    name: T("خالد الشهري", "Khalid Al-Shehri"),
    title: T("مفتش جودة", "Quality Inspector"),
    projects: ["p1"],
  },
  {
    key: "insB",
    email: "r.alzahrani@raqib.sa",
    role: "ins",
    name: T("ريم الزهراني", "Reem Al-Zahrani"),
    title: T("مفتشة جودة", "Quality Inspector"),
    projects: ["p2", "p3"],
  },
  {
    key: "gs",
    email: "m.alharbi@raqib.sa",
    role: "gs",
    name: T("ماجد الحربي", "Majed Al-Harbi"),
    title: T("مشرف أمن", "Security Supervisor"),
    projects: ["p1"],
  },
  {
    key: "guard",
    email: "g-10302@raqib.sa",
    role: "guard",
    name: T("عبدالله المطيري", "Abdullah Al-Mutairi"),
    title: T("حارس أمن", "Security Guard"),
    employeeNo: "G-10302",
    projects: ["p1"],
  },
  {
    key: "gm",
    email: "m.alsudairi@raqib.sa",
    role: "gm",
    name: T("أ. منصور السديري", "Mansour Al-Sudairi"),
    title: T("المدير العام", "General Manager"),
    projects: [],
  },
  {
    key: "adm",
    email: "h.alzahrani@raqib.sa",
    role: "adm",
    name: T("هند الزهراني", "Hind Al-Zahrani"),
    title: T("موظفة إدارية", "Administrative Staff"),
    projects: ["p1", "p2"],
  },
  {
    key: "sultan",
    email: "s.alghamdi@raqib.sa",
    role: "pm",
    name: T("سلطان الغامدي", "Sultan Al-Ghamdi"),
    title: T("مدير مشروع", "Project Manager"),
    projects: ["p2"],
  },
  {
    key: "buqami",
    email: "a.albuqami@raqib.sa",
    role: "pm",
    name: T("عبدالرحمن البقمي", "Abdulrahman Al-Buqami"),
    title: T("مدير مشروع", "Project Manager"),
    projects: ["p3"],
  },
  {
    key: "bandar",
    email: "b.alsubaie@raqib.sa",
    role: "gs",
    name: T("بندر السبيعي", "Bandar Al-Subaie"),
    title: T("مشرف موقع", "Site Supervisor"),
    projects: ["p1"],
  },
  {
    key: "naif",
    email: "n.alqarni@raqib.sa",
    role: "gs",
    name: T("نايف القرني", "Naif Al-Qarni"),
    title: T("مشرف أمن", "Security Supervisor"),
    status: "invited",
    projects: ["p2"],
  },
  {
    key: "waleed",
    email: "w.alasiri@raqib.sa",
    role: "ins",
    name: T("وليد العسيري", "Waleed Al-Asiri"),
    title: T("مفتش جودة", "Quality Inspector"),
    status: "disabled",
    projects: [],
  },
  {
    key: "turki",
    email: "g-10234@raqib.sa",
    role: "guard",
    name: T("تركي العنزي", "Turki Al-Anazi"),
    title: T("حارس أمن", "Security Guard"),
    employeeNo: "G-10234",
    projects: ["p1"],
  },
  {
    key: "legal",
    email: "h.alshammari@raqib.sa",
    role: "qe",
    name: T("هند الشمري — المستشار القانوني", "Hind Al-Shammari — Legal Counsel"),
    title: T("المستشار القانوني", "Legal Counsel"),
    projects: [],
  },
];

export interface DemoProject {
  key: string;
  code: string;
  name: L10n;
  city: L10n;
  region: L10n;
  manager: string;
  status: "active" | "attention" | "mobilizing";
  firstVisit?: string;
  guards: number;
  /** Days from today until the contract ends (the demo is always current), and how long ago it started. */
  contractEndInDays: number;
  sites: Array<{ key: string; name: L10n; areas: L10n[] }>;
}

export const DEMO_PROJECTS: DemoProject[] = [
  {
    key: "p1",
    code: "PRJ-RYD-014",
    name: T("مجمع الواحة للأعمال", "Al-Waha Business Park"),
    city: T("الرياض", "Riyadh"),
    region: T("الوسطى", "Central"),
    manager: "pm",
    status: "active",
    guards: 46,
    contractEndInDays: 120,
    sites: [
      { key: "s1", name: T("البوابة الرئيسية", "Main Gate"), areas: [T("بوابة المشاة", "Pedestrian gate"), T("بوابة المركبات", "Vehicle gate")] },
      {
        key: "s2",
        name: T("البرج أ", "Tower A"),
        areas: [T("الردهة", "Lobby"), T("المصاعد", "Lifts"), T("الطوابق 1–12", "Floors 1–12"), T("الطوابق 13–22", "Floors 13–22")],
      },
      { key: "s3", name: T("البرج ب", "Tower B"), areas: [T("الردهة", "Lobby"), T("مخارج الطوارئ", "Emergency exits")] },
      {
        key: "s4",
        name: T("مواقف السيارات", "Parking structure"),
        areas: [T("الطابق P1", "Level P1"), T("الطابق P2", "Level P2"), T("الطابق P3", "Level P3")],
      },
      { key: "s5", name: T("غرفة التحكم", "Control room"), areas: [T("المراقبة", "Monitoring"), T("الأرشيف", "Archive")] },
    ],
  },
  {
    key: "p2",
    code: "PRJ-JED-007",
    name: T("مركز جدة اللوجستي", "Jeddah Logistics Hub"),
    city: T("جدة", "Jeddah"),
    region: T("الغربية", "Western"),
    manager: "sultan",
    status: "attention",
    guards: 64,
    contractEndInDays: 400,
    sites: [
      { key: "s6", name: T("المستودع 3", "Warehouse 3"), areas: [T("منطقة التخزين", "Storage"), T("الأرصفة 4–9", "Docks 4–9")] },
      { key: "s7", name: T("بوابة الشاحنات", "Truck gate"), areas: [T("نقطة التفتيش", "Checkpoint"), T("الميزان", "Weighbridge")] },
      { key: "s8", name: T("ساحة الحاويات", "Container yard"), areas: [T("السور الشمالي", "North fence"), T("الإنارة", "Lighting")] },
      { key: "s9", name: T("المبنى الإداري", "Admin building"), areas: [T("الاستقبال", "Reception")] },
    ],
  },
  {
    key: "p3",
    code: "PRJ-DMM-003",
    name: T("مستشفى الشرقية التخصصي", "Eastern Specialist Hospital"),
    city: T("الدمام", "Dammam"),
    region: T("الشرقية", "Eastern"),
    manager: "buqami",
    status: "active",
    guards: 38,
    contractEndInDays: 60,
    sites: [
      { key: "s10", name: T("المدخل الرئيسي", "Main entrance"), areas: [T("الاستقبال", "Reception"), T("البوابات", "Gates")] },
      { key: "s11", name: T("قسم الطوارئ", "Emergency department"), areas: [T("مدخل الإسعاف", "Ambulance bay")] },
      { key: "s12", name: T("الصيدلية المركزية", "Central pharmacy"), areas: [T("المخزن المؤمن", "Secure store")] },
    ],
  },
  {
    key: "p4",
    code: "PRJ-RYD-019",
    name: T("مستودعات السلي", "Al-Sulay Warehouses"),
    city: T("الرياض", "Riyadh"),
    region: T("الوسطى", "Central"),
    manager: "pm",
    status: "mobilizing",
    firstVisit: "2026-10-19",
    guards: 0,
    contractEndInDays: 700,
    sites: [],
  },
];

export interface DemoGuard {
  key: string;
  employeeNo: string;
  nationalId: string;
  name: L10n;
  project: string;
  post: L10n;
  shift: "morning" | "evening" | "night";
  user?: string;
}

/** The named guards the approved scenarios refer to. Fillers up to each project's headcount are generated. */
export const DEMO_NAMED_GUARDS: DemoGuard[] = [
  {
    key: "g1",
    employeeNo: "G-10234",
    nationalId: "1087553412",
    name: T("تركي العنزي", "Turki Al-Anazi"),
    project: "p1",
    post: T("البوابة الرئيسية", "Main Gate"),
    shift: "morning",
    user: "turki",
  },
  {
    key: "g2",
    employeeNo: "G-10251",
    nationalId: "1093774208",
    name: T("يوسف الغامدي", "Yousef Al-Ghamdi"),
    project: "p1",
    post: T("البوابة الرئيسية", "Main Gate"),
    shift: "morning",
  },
  {
    key: "g3",
    employeeNo: "G-10288",
    nationalId: "1101226655",
    name: T("حسن الشمري", "Hassan Al-Shammari"),
    project: "p1",
    post: T("غرفة التحكم", "Control room"),
    shift: "night",
  },
  {
    key: "g4",
    employeeNo: "G-10302",
    nationalId: "1110448093",
    name: T("عبدالله المطيري", "Abdullah Al-Mutairi"),
    project: "p1",
    post: T("مواقف السيارات", "Parking"),
    shift: "evening",
    user: "guard",
  },
  {
    key: "g5",
    employeeNo: "G-20117",
    nationalId: "1079661871",
    name: T("مازن الحارثي", "Mazen Al-Harthi"),
    project: "p2",
    post: T("بوابة الشاحنات", "Truck gate"),
    shift: "morning",
  },
  {
    key: "g6",
    employeeNo: "G-20140",
    nationalId: "1095113330",
    name: T("سامي الجهني", "Sami Al-Juhani"),
    project: "p2",
    post: T("المستودع 3", "Warehouse 3"),
    shift: "evening",
  },
  {
    key: "g7",
    employeeNo: "G-30021",
    nationalId: "1082905547",
    name: T("علي البوعينين", "Ali Al-Buainain"),
    project: "p3",
    post: T("قسم الطوارئ", "Emergency dept."),
    shift: "morning",
  },
];

const FIRST: Array<[string, string]> = [
  ["محمد", "Mohammed"],
  ["أحمد", "Ahmed"],
  ["عبدالعزيز", "Abdulaziz"],
  ["سلمان", "Salman"],
  ["فيصل", "Faisal"],
  ["ناصر", "Nasser"],
  ["بدر", "Badr"],
  ["ماجد", "Majed"],
  ["راشد", "Rashed"],
  ["طلال", "Talal"],
  ["هاني", "Hani"],
  ["زياد", "Ziyad"],
];
const LAST: Array<[string, string]> = [
  ["القحطاني", "Al-Qahtani"],
  ["الدوسري", "Al-Dosari"],
  ["الحربي", "Al-Harbi"],
  ["العتيبي", "Al-Otaibi"],
  ["الزهراني", "Al-Zahrani"],
  ["الشهري", "Al-Shehri"],
  ["المالكي", "Al-Malki"],
  ["السبيعي", "Al-Subaie"],
  ["الغامدي", "Al-Ghamdi"],
  ["البلوي", "Al-Balawi"],
];

/** Deterministic filler guards so each project's headcount matches the approved design. */
export function fillerGuards(): DemoGuard[] {
  const out: DemoGuard[] = [];
  const prefix: Record<string, string> = { p1: "G-1", p2: "G-2", p3: "G-3" };
  for (const p of DEMO_PROJECTS) {
    if (!p.guards) continue;
    const have = DEMO_NAMED_GUARDS.filter((g) => g.project === p.key).length;
    const posts = p.sites.map((s) => s.name);
    for (let i = have; i < p.guards; i++) {
      const f = FIRST[(i * 7 + p.key.charCodeAt(1)) % FIRST.length]!;
      const l = LAST[(i * 3 + p.guards) % LAST.length]!;
      const n = 400 + i;
      out.push({
        key: `${p.key}-f${i}`,
        employeeNo: `${prefix[p.key]}${String(n).padStart(4, "0")}`,
        nationalId: `10${p.key.slice(1)}${String(1_000_000 + i * 7919).slice(-7)}`,
        name: T(`${f[0]} ${l[0]}`, `${f[1]} ${l[1]}`),
        project: p.key,
        post: posts[i % posts.length] ?? T("—", "—"),
        shift: (["morning", "evening", "night"] as const)[i % 3]!,
      });
    }
  }
  return out;
}
