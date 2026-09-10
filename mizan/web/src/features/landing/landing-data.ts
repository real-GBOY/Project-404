/**
 * Content and style helpers for the public landing page.
 *
 * Ported verbatim from the Claude Design prototype `Mizan Landing Page.dc.html`
 * (project 19070f72) and its `support.js` runtime. Every figure, court and case
 * name is representative firm data, not a real matter.
 */

export const NAVY = "#16233A";
export const SLATE = "#31456B";
export const BRASS = "#B99A5B";
export const PAPER = "#F5F3EF";
export const CARD = "#FAF9F6";

export type Tone = "brass" | "slate" | "green" | "amber" | "red" | "quiet";

const T: Record<Tone, [string, string]> = {
  brass: ["rgba(185,154,91,0.16)", "#6B5626"],
  slate: ["rgba(49,69,107,0.1)", SLATE],
  green: ["rgba(47,92,71,0.1)", "#2F5C47"],
  amber: ["rgba(122,106,60,0.14)", "#5F5228"],
  red: ["rgba(140,59,46,0.1)", "#8C3B2E"],
  quiet: ["rgba(22,35,58,0.06)", "rgba(22,35,58,0.7)"],
};

export function pill(tone: Tone | null | undefined): string {
  const t = (tone && T[tone]) || T.quiet;
  return (
    "display:inline-flex;align-items:center;padding:3px 9px;font-size:10.5px;font-weight:600;" +
    "letter-spacing:0.04em;white-space:nowrap;background:" +
    t[0] +
    ";color:" +
    t[1]
  );
}

type Width = number | "flex";

export function cell(w: Width, weight?: number, color?: string, extra?: string): string {
  return (
    (w === "flex" ? "flex:1;min-width:0;" : "width:" + w + "px;flex:0 0 " + w + "px;") +
    "font-size:12.5px;font-weight:" +
    (weight || 400) +
    ";color:" +
    (color || "rgba(22,35,58,0.8)") +
    ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" +
    (extra || "")
  );
}

export function head(w: Width): string {
  return (
    (w === "flex" ? "flex:1;min-width:0;" : "width:" + w + "px;flex:0 0 " + w + "px;") +
    "font-size:9.5px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:rgba(22,35,58,0.5);" +
    "white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
  );
}

/** Turn a CSS declaration string into a React style object. */
export function css(decls: string): React.CSSProperties {
  const out: Record<string, string> = {};
  for (const decl of decls.split(";")) {
    const i = decl.indexOf(":");
    if (i === -1) continue;
    const raw = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!raw || !value) continue;
    const prop = raw.startsWith("-")
      ? raw.replace(/^-(ms)-/, "$1-").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
      : raw.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[prop] = value;
  }
  return out as React.CSSProperties;
}

export interface ModuleDef {
  icon: string;
  num: string;
  name: string;
  body: string;
  tags: string[];
}

export const MODULES: ModuleDef[] = [
  {
    icon: "gavel",
    num: "01",
    name: "Matters",
    body: "Track every case from intake to resolution, with the court, circuit, stage and claim value on the record.",
    tags: ["68 open", "Civil · Commercial · Labour · Family"],
  },
  {
    icon: "apartment",
    num: "02",
    name: "Clients",
    body: "Complete client information and relationships — contacts, engagement terms, conflict checks, related matters.",
    tags: ["48 clients", "Corporate & individual"],
  },
  {
    icon: "folder_open",
    num: "03",
    name: "Documents",
    body: "Store, organize, preview and manage legal documents against the matter they belong to.",
    tags: ["1,284 filed", "Versioned"],
  },
  {
    icon: "balance",
    num: "04",
    name: "Hearings",
    body: "Sessions, adjournments and court dates in one calendar, with reminders before each appearance.",
    tags: ["23 scheduled", "Court-linked"],
  },
  {
    icon: "task_alt",
    num: "05",
    name: "Tasks",
    body: "Turn legal work into structured assignments with owners, priorities and deadlines that escalate.",
    tags: ["31 open", "Assigned & tracked"],
  },
  {
    icon: "receipt_long",
    num: "06",
    name: "Invoices",
    body: "Time entries, disbursements and invoices tracked per matter, so billing follows the work.",
    tags: ["96 invoices", "Time & disbursements"],
  },
];

type ShotCell = [string, Width, (Tone | null)?, number?];
type ShotAction = [string, "navy" | "slate" | "brassOutline"];

export interface ShotDef {
  label: string;
  title: string;
  meta: string;
  actions: ShotAction[];
  cols: [string, Width][];
  rows: ShotCell[][];
  asideTitle: string;
  aside: [string, string][];
}

export const SHOTS: Record<string, ShotDef> = {
  matters: {
    label: "Matters",
    title: "Matters",
    meta: "68 matters · filtered to active · sorted by next hearing",
    actions: [
      ["Filter · 2", "slate"],
      ["Add matter", "navy"],
    ],
    cols: [
      ["Matter no.", 96],
      ["Title & court", "flex"],
      ["Lead", 116],
      ["Next hearing", 100],
      ["Status", 92],
    ],
    rows: [
      [
        ["1042/2026", 96, "brass"],
        ["Al-Ahram Trading v. Delta Logistics — Cairo Economic Court, Circuit 7", "flex"],
        ["Mahmoud Nayel", 116],
        ["8 Sep 2026", 100],
        ["Active", 92, "slate"],
      ],
      [
        ["0987/2026", 96, "brass"],
        ["Nile Delta Construction — CRCICA Arbitration No. 1188", "flex"],
        ["Omar Al-Farouq", 116],
        ["14 Sep 2026", 100],
        ["Active", 92, "slate"],
      ],
      [
        ["0871/2026", 96, "brass"],
        ["Rania Fouad v. Zahran Group — Unfair dismissal", "flex"],
        ["Rania El-Sayed", 116],
        ["3 Sep 2026", 100],
        ["Hearing set", 92, "brass"],
      ],
      [
        ["0655/2025", 96, "brass"],
        ["Horus Pharma v. MedSupply — Trademark infringement", "flex"],
        ["Salma Ali", 116],
        ["21 Sep 2026", 100],
        ["Active", 92, "slate"],
      ],
      [
        ["0764/2026", 96, "brass"],
        ["Al-Sabah Estate — Partition of inherited property", "flex"],
        ["Nadia Al-Rashid", 116],
        ["—", 100],
        ["On hold", 92, "amber"],
      ],
      [
        ["0421/2025", 96, "brass"],
        ["Zahran Group v. Tax Authority — Cassation appeal", "flex"],
        ["Omar Al-Farouq", 116],
        ["6 Oct 2026", 100],
        ["Appeal filed", 92, "slate"],
      ],
    ],
    asideTitle: "Practice summary",
    aside: [
      ["Active", "51 of 68 matters"],
      ["On hold", "6 matters"],
      ["Aggregate value", "EGP 214M"],
      ["Opened this month", "4 matters"],
    ],
  },
  matter: {
    label: "Matter details",
    title: "1042/2026 — Al-Ahram Trading v. Delta Logistics",
    meta: "Commercial · Cairo Economic Court, Circuit 7 · claim EGP 6,400,000",
    actions: [
      ["Summarize", "brassOutline"],
      ["Export file", "slate"],
      ["Close matter", "navy"],
    ],
    cols: [
      ["Date", 104],
      ["Timeline entry", "flex"],
      ["By", 116],
      ["Attached", 84],
    ],
    rows: [
      [
        ["24 Aug 2026", 104],
        ["Hearing adjourned to 8 September to allow reply to the counterclaim", "flex"],
        ["Mahmoud Nayel", 116],
        ["1 file", 84, "quiet"],
      ],
      [
        ["17 Aug 2026", 104],
        ["Counterclaim of EGP 1.9M received from Delta Logistics", "flex"],
        ["Salma Ali", 116],
        ["2 files", 84, "quiet"],
      ],
      [
        ["12 Aug 2026", 104],
        ["Court fee receipt filed with the registry", "flex"],
        ["Youssef Mansour", 116],
        ["1 file", 84, "quiet"],
      ],
      [
        ["27 Jul 2026", 104],
        ["Formal demand notice served on the defendant", "flex"],
        ["Youssef Mansour", 116],
        ["1 file", 84, "quiet"],
      ],
      [
        ["18 Feb 2026", 104],
        ["Statement of claim filed with the Economic Court", "flex"],
        ["Mahmoud Nayel", 116],
        ["3 files", 84, "quiet"],
      ],
    ],
    asideTitle: "On this matter",
    aside: [
      ["Client", "Al-Ahram Trading Co."],
      ["Assigned", "M. Nayel · S. Ali · Y. Mansour"],
      ["Next deadline", "Reply to counterclaim · 31 Aug"],
      ["Financials", "EGP 1.42M billed · 412K outstanding"],
      ["Unbilled time", "38.5 hrs · EGP 123,200"],
    ],
  },
  client: {
    label: "Client profile",
    title: "Al-Ahram Trading Co.",
    meta: "Corporate client since March 2019 · CR 118-4402 · relationship partner Mahmoud Nayel",
    actions: [
      ["Send message", "slate"],
      ["New matter", "navy"],
    ],
    cols: [
      ["Matter no.", 96],
      ["Matter", "flex"],
      ["Type", 100],
      ["Next hearing", 100],
      ["Status", 92],
    ],
    rows: [
      [
        ["1042/2026", 96, "brass"],
        ["Al-Ahram Trading v. Delta Logistics — breach of supply contract", "flex"],
        ["Commercial", 100],
        ["8 Sep 2026", 100],
        ["Active", 92, "slate"],
      ],
      [
        ["0918/2025", 96, "brass"],
        ["Customs valuation objection — Alexandria port consignments", "flex"],
        ["Tax", 100],
        ["—", 100],
        ["Advisory", 92, "quiet"],
      ],
      [
        ["0844/2025", 96, "brass"],
        ["Distribution agreement — Upper Egypt territory", "flex"],
        ["Advisory", 100],
        ["—", 100],
        ["Active", 92, "slate"],
      ],
      [
        ["0692/2024", 96, "brass"],
        ["Warehouse lease dispute — Sixth of October", "flex"],
        ["Civil", 100],
        ["—", 100],
        ["Closed", 92, "green"],
      ],
    ],
    asideTitle: "Client record",
    aside: [
      ["Primary contact", "Hisham Abdel-Rahman · Group General Counsel"],
      ["Billed to date", "EGP 3,480,000"],
      ["Outstanding", "EGP 812,000"],
      ["Engagement", "Hourly · retainer EGP 120,000 / quarter"],
      ["Conflict check", "Cleared 12 Mar 2026"],
    ],
  },
  documents: {
    label: "Documents",
    title: "Documents",
    meta: "1,284 documents · 7 awaiting review · 2 expiring authorities",
    actions: [
      ["Filter", "slate"],
      ["Upload", "navy"],
    ],
    cols: [
      ["Document", "flex"],
      ["Matter", 96],
      ["Type", 106],
      ["Added", 100],
      ["State", 106],
    ],
    rows: [
      [
        ["Draft Statement of Defence — CRCICA 1188.docx", "flex"],
        ["0987/2026", 96, "brass"],
        ["Pleading", 106],
        ["27 Aug 2026", 100],
        ["Awaiting review", 106, "amber"],
      ],
      [
        ["Expert Report — MedSupply marks.pdf", "flex"],
        ["0655/2025", 96, "brass"],
        ["Expert report", 106],
        ["25 Aug 2026", 100],
        ["Awaiting review", 106, "amber"],
      ],
      [
        ["Power of Attorney — Zahran Group.pdf", "flex"],
        ["0421/2025", 96, "brass"],
        ["Authority", 106],
        ["22 Aug 2026", 100],
        ["Expiring", 106, "red"],
      ],
      [
        ["Statement of Claim — Al-Ahram v. Delta.pdf", "flex"],
        ["1042/2026", 96, "brass"],
        ["Pleading", 106],
        ["18 Aug 2026", 100],
        ["Filed", 106, "green"],
      ],
      [
        ["Supply Agreement (2024) — executed.pdf", "flex"],
        ["1042/2026", 96, "brass"],
        ["Contract", 106],
        ["16 Aug 2026", 100],
        ["Final", 106, "green"],
      ],
      [
        ["Judgment — Marina Bay lease.pdf", "flex"],
        ["0533/2025", 96, "brass"],
        ["Judgment", 106],
        ["11 Aug 2026", 100],
        ["Final", 106, "green"],
      ],
    ],
    asideTitle: "Library",
    aside: [
      ["Pleadings", "412 documents"],
      ["Contracts", "286 documents"],
      ["Evidence", "301 documents"],
      ["Authorities", "94 documents"],
      ["Retention", "Matter lifetime + 7 years"],
    ],
  },
  hearings: {
    label: "Hearings",
    title: "Hearings & sessions",
    meta: "23 scheduled · 3 in the next 7 days · 4 awaiting a court date",
    actions: [
      ["Calendar view", "slate"],
      ["Schedule hearing", "navy"],
    ],
    cols: [
      ["Date", 104],
      ["Time", 62],
      ["Matter", 96],
      ["Court", "flex"],
      ["Attending", 116],
      ["Status", 100],
    ],
    rows: [
      [
        ["3 Sep 2026", 104],
        ["09:30", 62],
        ["0871/2026", 96, "brass"],
        ["North Cairo Labour Court · Circuit 2", "flex"],
        ["Rania El-Sayed", 116],
        ["Confirmed", 100, "green"],
      ],
      [
        ["8 Sep 2026", 104],
        ["10:00", 62],
        ["1042/2026", 96, "brass"],
        ["Cairo Economic Court · Circuit 7", "flex"],
        ["Mahmoud Nayel", 116],
        ["Confirmed", 100, "green"],
      ],
      [
        ["14 Sep 2026", 104],
        ["11:30", 62],
        ["0987/2026", 96, "brass"],
        ["CRCICA · Hearing Room 4", "flex"],
        ["Omar Al-Farouq", 116],
        ["Procedural", 100, "slate"],
      ],
      [
        ["21 Sep 2026", 104],
        ["09:00", 62],
        ["0655/2025", 96, "brass"],
        ["Cairo Economic Court · Circuit 3", "flex"],
        ["Salma Ali", 116],
        ["Awaiting court", 100, "amber"],
      ],
      [
        ["6 Oct 2026", 104],
        ["10:30", 62],
        ["0421/2025", 96, "brass"],
        ["Court of Cassation", "flex"],
        ["Omar Al-Farouq", 116],
        ["Confirmed", 100, "green"],
      ],
    ],
    asideTitle: "This month",
    aside: [
      ["Sessions held", "4 of 7"],
      ["Adjourned", "1 session"],
      ["Reminders", "3 and 1 days before"],
      ["Court holidays", "Registry closed 23 Sep"],
    ],
  },
  tasks: {
    label: "Tasks",
    title: "Tasks",
    meta: "31 open · 9 due this week · 2 overdue",
    actions: [
      ["Assignee", "slate"],
      ["Add task", "navy"],
    ],
    cols: [
      ["Task", "flex"],
      ["Matter", 96],
      ["Assignee", 124],
      ["Due", 100],
      ["Priority", 84],
    ],
    rows: [
      [
        ["File court fee receipt — Circuit 7", "flex"],
        ["1042/2026", 96, "brass"],
        ["Youssef Mansour", 124],
        ["26 Aug 2026", 100],
        ["Overdue", 84, "red"],
      ],
      [
        ["Translate supply agreement annexes", "flex"],
        ["0612/2025", 96, "brass"],
        ["Nadia Al-Rashid", 124],
        ["28 Aug 2026", 100],
        ["Overdue", 84, "red"],
      ],
      [
        ["Draft reply to Delta Logistics counterclaim", "flex"],
        ["1042/2026", 96, "brass"],
        ["Salma Ali", 124],
        ["31 Aug 2026", 100],
        ["High", 84, "amber"],
      ],
      [
        ["Prepare witness list for labour hearing", "flex"],
        ["0871/2026", 96, "brass"],
        ["Rania El-Sayed", 124],
        ["2 Sep 2026", 100],
        ["High", 84, "amber"],
      ],
      [
        ["Review expert report — trademark claim", "flex"],
        ["0655/2025", 96, "brass"],
        ["Salma Ali", 124],
        ["4 Sep 2026", 100],
        ["Medium", 84, "quiet"],
      ],
      [
        ["Reconcile August disbursements", "flex"],
        ["Firm-wide", 96, "quiet"],
        ["Mona Fahmy", 124],
        ["7 Sep 2026", 100],
        ["Low", 84, "quiet"],
      ],
    ],
    asideTitle: "Workload",
    aside: [
      ["Salma Ali", "16 matters · 95% utilisation"],
      ["Omar Al-Farouq", "11 matters · 92%"],
      ["Youssef Mansour", "22 filings · 81%"],
      ["Completed", "46 tasks in 30 days"],
    ],
  },
  invoices: {
    label: "Invoices",
    title: "Billing",
    meta: "EGP 14.2M billed YTD · EGP 9.84M collected · 69% collection rate",
    actions: [
      ["Export", "slate"],
      ["New invoice", "navy"],
    ],
    cols: [
      ["Invoice", 136],
      ["Client", "flex"],
      ["Matter", 96],
      ["Due", 100],
      ["Amount", 116],
      ["Status", 100],
    ],
    rows: [
      [
        ["INV-2026-0418", 136, "brass"],
        ["Zahran Group Holding", "flex"],
        ["0421/2025", 96],
        ["4 Sep 2026", 100],
        ["EGP 640,000", 116, null, 600],
        ["Sent", 100, "slate"],
      ],
      [
        ["INV-2026-0417", 136, "brass"],
        ["Al-Ahram Trading Co.", "flex"],
        ["1042/2026", 96],
        ["1 Sep 2026", 100],
        ["EGP 412,000", 116, null, 600],
        ["Partly paid", 100, "amber"],
      ],
      [
        ["INV-2026-0416", 136, "brass"],
        ["Horus Pharmaceuticals", "flex"],
        ["0655/2025", 96],
        ["27 Aug 2026", 100],
        ["EGP 302,000", 116, null, 600],
        ["Overdue", 100, "red"],
      ],
      [
        ["INV-2026-0415", 136, "brass"],
        ["Nile Delta Construction", "flex"],
        ["0987/2026", 96],
        ["23 Aug 2026", 100],
        ["EGP 465,500", 116, null, 600],
        ["Overdue", 100, "red"],
      ],
      [
        ["INV-2026-0414", 136, "brass"],
        ["Emirates Steel Fabrication", "flex"],
        ["0612/2025", 96],
        ["19 Aug 2026", 100],
        ["AED 148,000", 116, null, 600],
        ["Paid", 100, "green"],
      ],
    ],
    asideTitle: "Finance",
    aside: [
      ["Outstanding", "EGP 4,360,000"],
      ["Overdue", "3 invoices · EGP 791,500"],
      ["Unbilled time", "214.5 hrs ≈ EGP 1.28M"],
      ["Average days to pay", "34 days"],
    ],
  },
};

export const SHOT_ORDER = [
  "matters",
  "matter",
  "client",
  "documents",
  "hearings",
  "tasks",
  "invoices",
] as const;

export interface AiRow {
  mon: string;
  day: string;
  title: string;
  meta: string;
  tag: string;
  tone: Tone;
}

export interface AiDef {
  label: string;
  icon: string;
  scope: string;
  question: string;
  answer: string;
  source: string;
  rows?: AiRow[];
}

export const AI: Record<string, AiDef> = {
  summarize: {
    label: "Summarize this matter.",
    icon: "summarize",
    scope: "Matter 1042/2026",
    question: "Summarize the status of matter 1042/2026.",
    answer:
      "Al-Ahram Trading v. Delta Logistics is active at first instance on the merits, before the Cairo Economic Court (Circuit 7). The claim is EGP 6.4M for breach of the 2024 exclusive supply agreement.\n\nThe statement of claim was filed on 18 February. Delta Logistics filed a EGP 1.9M counterclaim on 17 August alleging late acceptance of shipments, and the session of 24 August was adjourned to 8 September for our reply. Shipping logs for consignments 14–22 contradict that allegation.\n\nOpen items: reply to the counterclaim (Salma Ali, due 31 August), the court fee receipt filing which is overdue, and power of attorney renewal before 17 September.",
    source: "14 records · 1 matter",
  },
  hearings: {
    label: "What are the upcoming hearings for this client?",
    icon: "balance",
    scope: "Al-Ahram Trading Co.",
    question: "What are the upcoming hearings for Al-Ahram Trading?",
    answer: "Two sessions are listed in the next six weeks across this client's open matters.",
    rows: [
      {
        mon: "SEP",
        day: "8",
        title: "Al-Ahram Trading v. Delta Logistics",
        meta: "10:00 · Cairo Economic Court, Circuit 7 · M. Nayel",
        tag: "Merits",
        tone: "slate",
      },
      {
        mon: "SEP",
        day: "30",
        title: "Customs valuation objection — hearing",
        meta: "09:30 · Alexandria Economic Court · S. Ali",
        tag: "Provisional",
        tone: "amber",
      },
    ],
    source: "2 hearings · 3 matters",
  },
  activity: {
    label: "Show me the recent activity on this matter.",
    icon: "history",
    scope: "Matter 1042/2026",
    question: "Show me the recent activity on matter 1042/2026.",
    answer: "The last four entries on the matter, most recent first.",
    rows: [
      {
        mon: "AUG",
        day: "27",
        title: "Reply to counterclaim drafted (v3)",
        meta: "Salma Ali · 4.5 hrs recorded",
        tag: "Draft",
        tone: "brass",
      },
      {
        mon: "AUG",
        day: "24",
        title: "Hearing adjourned to 8 September",
        meta: "Mahmoud Nayel · session minutes filed",
        tag: "Hearing",
        tone: "slate",
      },
      {
        mon: "AUG",
        day: "17",
        title: "Counterclaim received — EGP 1.9M",
        meta: "Salma Ali · 2 documents attached",
        tag: "Filing",
        tone: "amber",
      },
    ],
    source: "4 activity entries",
  },
  docs: {
    label: "What documents are associated with this case?",
    icon: "folder_open",
    scope: "Matter 1042/2026",
    question: "What documents are associated with this case?",
    answer:
      "Nine documents are filed against matter 1042/2026. The three most relevant to the September session:",
    rows: [
      {
        mon: "AUG",
        day: "18",
        title: "Statement of Claim — Al-Ahram v. Delta.pdf",
        meta: "Pleading · 2.4 MB · filed with the court",
        tag: "Filed",
        tone: "green",
      },
      {
        mon: "AUG",
        day: "17",
        title: "Counterclaim-Delta.pdf",
        meta: "Pleading · received from the defendant",
        tag: "Received",
        tone: "slate",
      },
      {
        mon: "AUG",
        day: "16",
        title: "Supply Agreement (2024) — executed.pdf",
        meta: "Contract · 8.1 MB · signed original",
        tag: "Final",
        tone: "green",
      },
    ],
    source: "9 documents · 1 matter",
  },
};

export const AI_ORDER = ["summarize", "hearings", "activity", "docs"] as const;

export const AI_CHAIN: { title: string; body: string }[] = [
  {
    title: "The lawyer asks in plain language",
    body: "A question typed anywhere in the product, in Arabic or English.",
  },
  {
    title: "Mizan AI interprets the request",
    body: "It resolves which matter, client or date range is meant from the context you are in.",
  },
  {
    title: "Permission-aware system tools",
    body: "The assistant calls the same authorized capabilities the interface uses — never the database directly.",
  },
  {
    title: "Mizan data and workflows",
    body: "The answer is assembled from records the signed-in user can already open, and every read is logged.",
  },
];

export interface DocDef {
  name: string;
  meta: string;
  st: string;
  tone: Tone;
  court: string;
  heading: string;
  ref: string;
  page: string;
  metaRows: [string, string][];
}

export const DOCS: DocDef[] = [
  {
    name: "Draft Statement of Defence — CRCICA 1188.docx",
    meta: "Pleading · v4 · Omar Al-Farouq",
    st: "Awaiting review",
    tone: "amber",
    court: "Cairo Regional Centre for Arbitration",
    heading: "Statement of Defence — Case No. 1188",
    ref: "CRCICA 1188",
    page: "Page 1 of 24",
    metaRows: [
      ["Matter", "0987/2026"],
      ["Category", "Pleading"],
      ["Version", "v4 · 27 Aug 2026"],
      ["Size", "1.2 MB"],
      ["Uploaded by", "Omar Al-Farouq"],
      ["Review", "Due before 1 Sep"],
    ],
  },
  {
    name: "Expert Report — MedSupply marks.pdf",
    meta: "Expert report · 14 MB · court expert",
    st: "Awaiting review",
    tone: "amber",
    court: "Cairo Economic Court · Circuit 3",
    heading: "Expert Report on Trademark Similarity",
    ref: "0655/2025",
    page: "Page 1 of 118",
    metaRows: [
      ["Matter", "0655/2025"],
      ["Category", "Expert report"],
      ["Version", "Final · 25 Aug 2026"],
      ["Size", "14 MB"],
      ["Source", "Court-appointed expert"],
      ["Review", "Salma Ali"],
    ],
  },
  {
    name: "Supply Agreement (2024) — executed.pdf",
    meta: "Contract · 8.1 MB · signed original",
    st: "Final",
    tone: "green",
    court: "Al-Ahram Trading Co. & Delta Logistics",
    heading: "Exclusive Supply Agreement",
    ref: "1042/2026",
    page: "Page 1 of 42",
    metaRows: [
      ["Matter", "1042/2026"],
      ["Category", "Contract"],
      ["Version", "Executed · 11 Jan 2024"],
      ["Size", "8.1 MB"],
      ["Uploaded by", "Salma Ali"],
      ["Status", "Evidence on file"],
    ],
  },
  {
    name: "Power of Attorney — Zahran Group.pdf",
    meta: "Authority · expires 17 Sep 2026",
    st: "Expiring",
    tone: "red",
    court: "Notary Public · Alexandria",
    heading: "Special Power of Attorney",
    ref: "0421/2025",
    page: "Page 1 of 3",
    metaRows: [
      ["Matter", "0421/2025"],
      ["Category", "Authority"],
      ["Issued", "18 Mar 2025"],
      ["Expires", "17 Sep 2026"],
      ["Uploaded by", "Youssef Mansour"],
      ["Action", "Renewal booked"],
    ],
  },
  {
    name: "Judgment — Marina Bay lease.pdf",
    meta: "Judgment · 1.9 MB · court registry",
    st: "Final",
    tone: "green",
    court: "South Cairo Court of First Instance",
    heading: "Judgment in Case No. 0533/2025",
    ref: "0533/2025",
    page: "Page 1 of 16",
    metaRows: [
      ["Matter", "0533/2025"],
      ["Category", "Judgment"],
      ["Issued", "11 Aug 2026"],
      ["Size", "1.9 MB"],
      ["Source", "Court registry"],
      ["Outcome", "Favourable"],
    ],
  },
];

export interface FlowDef {
  icon: string;
  label: string;
  num: string;
  headline: string;
  body: string;
  items: [string, string][];
}

export const FLOW: FlowDef[] = [
  {
    icon: "apartment",
    label: "Client",
    num: "01",
    headline: "Intake, conflict check, engagement terms.",
    body: "The client record is opened once: contacts, registration, billing arrangement and a conflict check that has to clear before work begins.",
    items: [
      ["Client", "Al-Ahram Trading Co."],
      ["Contact", "Hisham Abdel-Rahman"],
      ["Conflict check", "Cleared 12 Mar 2026"],
      ["Terms", "Hourly · quarterly retainer"],
    ],
  },
  {
    icon: "gavel",
    label: "Matter",
    num: "02",
    headline: "The matter becomes the unit of work.",
    body: "Everything after this point attaches to the matter — its court, circuit, stage, claim value, lead lawyer and assigned team.",
    items: [
      ["Matter", "1042/2026"],
      ["Type", "Commercial"],
      ["Court", "Cairo Economic Court · C7"],
      ["Lead", "Mahmoud Nayel"],
    ],
  },
  {
    icon: "folder_open",
    label: "Documents",
    num: "03",
    headline: "Evidence and pleadings filed in place.",
    body: "Contracts, notices and pleadings are filed against the matter with version history, so the working copy is never in doubt.",
    items: [
      ["Filed", "9 documents"],
      ["Latest", "Counterclaim-Delta.pdf"],
      ["Awaiting review", "1 document"],
      ["Retention", "Matter + 7 years"],
    ],
  },
  {
    icon: "task_alt",
    label: "Tasks",
    num: "04",
    headline: "Work is assigned, not remembered.",
    body: "Drafting, filing and follow-ups become tasks with an owner, a priority and a deadline that escalates to the lead partner.",
    items: [
      ["Open tasks", "3 on this matter"],
      ["Next due", "Reply to counterclaim · 31 Aug"],
      ["Owner", "Salma Ali"],
      ["Escalation", "48 hours before due"],
    ],
  },
  {
    icon: "balance",
    label: "Hearings",
    num: "05",
    headline: "Sessions, adjournments and outcomes.",
    body: "Each session carries its date, circuit, attending lawyer and what the court decided — including adjournments and their reasons.",
    items: [
      ["Next session", "8 Sep 2026 · 10:00"],
      ["Last session", "24 Aug · adjourned"],
      ["Attending", "M. Nayel, S. Ali"],
      ["Reminders", "3 and 1 days before"],
    ],
  },
  {
    icon: "receipt_long",
    label: "Billing",
    num: "06",
    headline: "Time and disbursements follow the work.",
    body: "Hours recorded against the matter and court fees paid on its behalf flow into the invoice without re-entry.",
    items: [
      ["Billed", "EGP 1,420,000"],
      ["Unbilled", "38.5 hrs · EGP 123,200"],
      ["Disbursements", "EGP 87,400"],
      ["Outstanding", "EGP 412,000"],
    ],
  },
  {
    icon: "verified",
    label: "Resolution",
    num: "07",
    headline: "Closed with its history intact.",
    body: "Judgment or settlement is recorded, the file is closed, and the complete activity history stays available for audit and future reference.",
    items: [
      ["Outcome", "Judgment or settlement"],
      ["Closing checklist", "6 items"],
      ["Audit history", "Retained in full"],
      ["Archive", "Read-only after closing"],
    ],
  },
];

export interface SecurityDef {
  icon: string;
  title: string;
  body: string;
  tech: string;
}

export const SECURITY: SecurityDef[] = [
  {
    icon: "admin_panel_settings",
    title: "Role-based access",
    body: "Partners, associates, paralegals and finance staff see the matters and figures their role allows, not the whole firm by default.",
    tech: "Roles · permissions · per-matter assignment",
  },
  {
    icon: "domain",
    title: "Organization isolation",
    body: "Each firm's data is scoped to its own organization boundary, enforced on every request rather than filtered in the interface.",
    tech: "Tenant scoping at the data layer",
  },
  {
    icon: "auto_awesome",
    title: "Permission-aware AI",
    body: "The assistant acts through the same authorized capabilities as a user session, so it cannot read or change what that user cannot.",
    tech: "Tool-mediated access · no direct queries",
  },
  {
    icon: "history",
    title: "Audit history",
    body: "Reads, edits, uploads and assistant actions are attributable to a person and a time, and the trail cannot be edited after the fact.",
    tech: "Append-only audit log",
  },
  {
    icon: "lock",
    title: "Controlled document access",
    body: "Documents inherit the permissions of the matter they belong to; privileged notes are excluded from client-facing exports.",
    tech: "Inherited ACLs · export rules",
  },
  {
    icon: "shield",
    title: "Secure file handling",
    body: "Files are stored outside the application tier and served through short-lived, authorized links rather than public paths.",
    tech: "Signed URLs · encrypted at rest",
  },
];

export const BEFORE: [string, string][] = [
  ["Spreadsheets", "A matter list someone has to remember to update"],
  ["Messaging apps", "Decisions and instructions buried in a group chat"],
  ["Cloud folders", "Documents by folder path, not by matter"],
  ["Separate calendars", "Hearings that only one person can see"],
  ["Manual follow-ups", "Deadlines that depend on who remembers them"],
  ["Disconnected billing", "Hours re-typed from notes at the end of the month"],
];

export const AFTER: [string, string][] = [
  ["One matter record", "Court, stage, team, value and history in one place"],
  ["Documents on the matter", "Filed, versioned and previewable where the work is"],
  ["A shared calendar", "Hearings and deadlines visible to whoever needs them"],
  ["Tasks with owners", "Assigned, prioritised and escalated before they slip"],
  ["Billing from the work", "Time and disbursements flow into the invoice"],
  ["Intelligence inside it", "Answers and drafts from the firm's own records"],
];

export const HERO_HEARINGS = [
  {
    mon: "SEP",
    day: "3",
    title: "Rania Fouad v. Zahran Group",
    court: "North Cairo Labour Court · Circuit 2",
    time: "09:30",
  },
  {
    mon: "SEP",
    day: "8",
    title: "Al-Ahram Trading v. Delta Logistics",
    court: "Cairo Economic Court · Circuit 7",
    time: "10:00",
  },
  {
    mon: "SEP",
    day: "14",
    title: "CRCICA Arbitration No. 1188",
    court: "CRCICA · Hearing Room 4",
    time: "11:30",
  },
];

export const SCATTERED = [
  "Matters spreadsheet",
  "WhatsApp group",
  "Shared drive",
  "Personal calendar",
  "Paper court file",
  "Billing ledger",
];

export const UNIFIED = [
  { icon: "apartment", label: "Client", meta: "Al-Ahram Trading" },
  { icon: "folder_open", label: "Documents", meta: "9 filed" },
  { icon: "balance", label: "Hearings", meta: "Next 8 Sep" },
  { icon: "task_alt", label: "Tasks", meta: "3 open" },
  { icon: "receipt_long", label: "Billing", meta: "EGP 412K due" },
  { icon: "history", label: "Activity history", meta: "Complete" },
];

export const DOC_CATS: [string, boolean][] = [
  ["All", true],
  ["Pleadings", false],
  ["Contracts", false],
  ["Evidence", false],
  ["Authorities", false],
  ["Judgments", false],
];

export function actionStyle(kind: ShotAction[1]): string {
  if (kind === "navy")
    return (
      "display:inline-flex;align-items:center;padding:8px 14px;background:" +
      NAVY +
      ";color:" +
      PAPER +
      ";font-size:10.5px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;white-space:nowrap"
    );
  if (kind === "brassOutline")
    return "display:inline-flex;align-items:center;padding:8px 14px;border:1px solid rgba(185,154,91,0.7);color:#6B5626;font-size:10.5px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;white-space:nowrap";
  return (
    "display:inline-flex;align-items:center;padding:8px 14px;border:1px solid rgba(22,35,58,0.2);color:" +
    SLATE +
    ";font-size:10.5px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;white-space:nowrap"
  );
}

/** Showcase table cell → { text, style } as the prototype's renderVals did. */
export function shotCellStyle(c: ShotCell): { text: string; style: string } {
  const [text, w, tone, weight] = c;
  if (tone && T[tone] && w !== "flex" && tone !== "brass") {
    return { text, style: "width:" + w + "px;flex:0 0 " + w + "px;" + pill(tone) };
  }
  if (tone === "brass") return { text, style: cell(w, 600, "#6B5626", "letter-spacing:0.04em") };
  if (tone === "quiet") return { text, style: cell(w, 400, "rgba(22,35,58,0.55)") };
  return { text, style: cell(w, weight || (w === "flex" ? 500 : 400)) };
}
