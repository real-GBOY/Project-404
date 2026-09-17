/**
 * Demo dataset — ported from `atlas/web/src/mocks/fixtures/*` (names, projects,
 * roster, AI insight copy), reconciled to be internally consistent rather than
 * copied byte-for-byte (the source fixtures have known inconsistencies flagged
 * during the data-model research: inventory-count overcounts, a building
 * double-source mismatch, a roles headcount gap — none of that is reproduced
 * here; every number below is either authored once or genuinely derived).
 */

export interface DemoTeamMember {
  key: string;
  name: string;
  email: string;
  roleKey: string;
}

/** Mostafa Halim ("usr_dev") is the demo login — matches atlas/web's static `lib/session.ts`. */
export const DEMO_TEAM: DemoTeamMember[] = [
  { key: "usr_dev", name: "Mostafa Halim", email: "mostafa.halim@atlas.eg", roleKey: "administrator" },
  { key: "ahmed", name: "Ahmed Mohamed", email: "ahmed.m@atlas.eg", roleKey: "sales_agent" },
  { key: "sara", name: "Sara Fathy", email: "sara.f@atlas.eg", roleKey: "sales_agent" },
  { key: "youssef", name: "Youssef Hegazy", email: "youssef.h@atlas.eg", roleKey: "sales_manager" },
  { key: "menna", name: "Menna Kamal", email: "menna.k@atlas.eg", roleKey: "sales_agent" },
  { key: "mohamed", name: "Mohamed Adel", email: "mohamed.a@atlas.eg", roleKey: "sales_manager" },
  { key: "nadine", name: "Nadine Farid", email: "nadine.f@atlas.eg", roleKey: "finance_controller" },
  { key: "kariman", name: "Kariman Osman", email: "kariman.o@atlas.eg", roleKey: "sales_agent" },
];

export interface DemoProject {
  key: string;
  name: string;
  location: string;
  developer: string;
  status: "pre-launch" | "launched" | "under-construction" | "delivered";
  buildings: Array<{ key: string; name: string; floors: number; unitsPerFloor: number }>;
}

export const DEMO_PROJECTS: DemoProject[] = [
  {
    key: "north-hills",
    name: "North Hills",
    location: "New Cairo · 5th Settlement",
    developer: "Atlas Developments",
    status: "launched",
    buildings: [
      { key: "A", name: "Building A", floors: 10, unitsPerFloor: 8 },
      { key: "B", name: "Building B", floors: 8, unitsPerFloor: 6 },
    ],
  },
  {
    key: "palm-district",
    name: "Palm District",
    location: "6th of October · Sheikh Zayed",
    developer: "Atlas Developments",
    status: "under-construction",
    buildings: [
      { key: "A", name: "Building A", floors: 9, unitsPerFloor: 6 },
      { key: "B", name: "Building B", floors: 7, unitsPerFloor: 6 },
    ],
  },
  {
    key: "cedar-res",
    name: "Cedar Residences",
    location: "Sheikh Zayed · Beverly Hills",
    developer: "Atlas × Marakez JV",
    status: "launched",
    buildings: [{ key: "A", name: "Building A", floors: 6, unitsPerFloor: 8 }],
  },
  {
    key: "skyline",
    name: "Skyline Business Park",
    location: "New Administrative Capital",
    developer: "Atlas Commercial",
    status: "under-construction",
    buildings: [{ key: "C1", name: "Tower C1", floors: 12, unitsPerFloor: 4 }],
  },
  {
    key: "west-ave",
    name: "West Avenue",
    location: "Mostakbal City",
    developer: "Atlas Developments",
    status: "pre-launch",
    buildings: [{ key: "A", name: "Building A", floors: 5, unitsPerFloor: 6 }],
  },
];

export type DemoLeadStage = "new" | "qualified" | "contacted" | "viewing" | "negotiation" | "reserved" | "contracted" | "sold" | "lost";

export interface DemoLead {
  name: string;
  phone: string;
  source: "referral" | "website" | "facebook" | "broker" | "exhibition" | "instagram";
  agentKey: string;
  interestText: string;
  valueEgpM: number;
  /** Stage to move the lead to after creation (every lead starts at "new"); omit to leave it at "new". */
  stage?: DemoLeadStage;
  /** Also record it as a tracked opportunity (Pipeline board deal card). */
  trackAsDeal?: boolean;
  /**
   * Raw agent notes for the Lead AI Intelligence feature — seeded verbatim
   * (never a pre-computed AI result: see demo-seeder.ts) so the "Analyze
   * requirements" step has something real to demonstrate against, in both
   * languages agents actually use.
   */
  requirementsNotes?: string;
}

/**
 * A deliberately full spread across every `STAGES` bucket (see
 * `leads.schema.ts`) so the dashboard's Lead Conversion Funnel reads as a
 * real, decaying funnel instead of one bar. Counts by stage: new 7 ·
 * qualified 5 · contacted 4 · viewing 3 · negotiation 3 · reserved 2 ·
 * contracted 1 · sold 1 · lost 2 (28 leads total).
 */
export const DEMO_LEADS: DemoLead[] = [
  {
    name: "Tarek ElGohary",
    phone: "+201001234567",
    source: "referral",
    agentKey: "ahmed",
    interestText: "North Hills · 3-Bed",
    valueEgpM: 4.85,
    stage: "negotiation",
    requirementsNotes: "عايز شقة في New Cairo حوالي 8 لـ 10 مليون، 3 bedrooms، preferably first floor، وعايز استلام خلال سنتين.",
  },
  { name: "Hossam Adly", phone: "+201001234568", source: "website", agentKey: "sara", interestText: "Palm District · Duplex", valueEgpM: 15.2, stage: "viewing", trackAsDeal: true },
  {
    name: "Mona Fahmy",
    phone: "+201001234569",
    source: "broker",
    agentKey: "ahmed",
    interestText: "North Hills · 4-Bed",
    valueEgpM: 5.6,
    stage: "qualified",
    requirementsNotes: "Looking for a 4 bedroom apartment in North Hills, budget around 9 to 9.5 million EGP, no particular floor preference, wants to move in within a year.",
  },
  { name: "Karim Abdelrahman", phone: "+201001234570", source: "exhibition", agentKey: "menna", interestText: "Cedar Residences · 2-Bed", valueEgpM: 4.2 },
  { name: "Rania Ezzat", phone: "+201001234571", source: "instagram", agentKey: "sara", interestText: "North Hills · 2-Bed", valueEgpM: 4.6 },
  { name: "Omar Shaker", phone: "+201001234572", source: "referral", agentKey: "kariman", interestText: "Skyline · Office", valueEgpM: 11.2 },
  { name: "Yara Mostafa", phone: "+201001234573", source: "website", agentKey: "menna", interestText: "West Avenue · 1-Bed", valueEgpM: 2.9 },
  { name: "Ziad Fouad", phone: "+201001234574", source: "broker", agentKey: "kariman", interestText: "Palm District · 3-Bed", valueEgpM: 6.4 },
  { name: "Amira Zaki", phone: "+201001234575", source: "facebook", agentKey: "sara", interestText: "West Avenue · 1-Bed", valueEgpM: 3.1 },
  { name: "Sherif Nabil", phone: "+201001234576", source: "referral", agentKey: "ahmed", interestText: "North Hills · 2-Bed", valueEgpM: 4.4 },
  { name: "Dalia Kassem", phone: "+201001234577", source: "website", agentKey: "menna", interestText: "Cedar Residences · 3-Bed", valueEgpM: 5.9, stage: "qualified" },
  { name: "Amr Sabry", phone: "+201001234578", source: "broker", agentKey: "kariman", interestText: "Palm District · 4-Bed", valueEgpM: 8.7, stage: "qualified" },
  { name: "Nour Samir", phone: "+201001234579", source: "exhibition", agentKey: "ahmed", interestText: "Skyline · Retail", valueEgpM: 9.4, stage: "qualified" },
  { name: "Salma Hamdy", phone: "+201001234580", source: "instagram", agentKey: "sara", interestText: "North Hills · 3-Bed", valueEgpM: 4.9, stage: "qualified" },
  { name: "Wael Toukhy", phone: "+201001234581", source: "website", agentKey: "menna", interestText: "West Avenue · 2-Bed", valueEgpM: 3.6, stage: "contacted" },
  { name: "Heba Rostom", phone: "+201001234582", source: "broker", agentKey: "kariman", interestText: "Palm District · 2-Bed", valueEgpM: 5.1, stage: "contacted" },
  { name: "Fady Younan", phone: "+201001234583", source: "referral", agentKey: "ahmed", interestText: "Cedar Residences · 4-Bed", valueEgpM: 7.2, stage: "contacted" },
  { name: "Mariam Adly", phone: "+201001234584", source: "facebook", agentKey: "sara", interestText: "North Hills · Duplex", valueEgpM: 9.8, stage: "contacted" },
  { name: "Ahmed Zahran", phone: "+201001234585", source: "exhibition", agentKey: "menna", interestText: "Skyline · Office", valueEgpM: 10.6, stage: "viewing" },
  { name: "Rasha ElBanna", phone: "+201001234586", source: "instagram", agentKey: "kariman", interestText: "Palm District · Duplex", valueEgpM: 14.5, stage: "viewing" },
  { name: "Tamer Wagdy", phone: "+201001234587", source: "website", agentKey: "ahmed", interestText: "Cedar Residences · 2-Bed", valueEgpM: 4.3, stage: "negotiation" },
  { name: "Nesma Fathallah", phone: "+201001234588", source: "referral", agentKey: "sara", interestText: "North Hills · 4-Bed", valueEgpM: 5.7, stage: "negotiation" },
  { name: "Khaled Anwar", phone: "+201001234589", source: "broker", agentKey: "menna", interestText: "Palm District · 3-Bed", valueEgpM: 6.8, stage: "reserved" },
  { name: "Yasmine Adel", phone: "+201001234590", source: "exhibition", agentKey: "kariman", interestText: "Cedar Residences · 3-Bed", valueEgpM: 5.6, stage: "reserved" },
  { name: "Mahmoud Fekry", phone: "+201001234591", source: "website", agentKey: "ahmed", interestText: "North Hills · 2-Bed", valueEgpM: 4.4, stage: "contracted" },
  { name: "Nihal Sabet", phone: "+201001234592", source: "referral", agentKey: "sara", interestText: "Cedar Residences · 4-Bed", valueEgpM: 7.5, stage: "sold" },
  { name: "Ayman Ragab", phone: "+201001234593", source: "facebook", agentKey: "menna", interestText: "Skyline · Office", valueEgpM: 9.1, stage: "lost" },
  { name: "Dina ElHawary", phone: "+201001234594", source: "instagram", agentKey: "kariman", interestText: "West Avenue · 1-Bed", valueEgpM: 2.8, stage: "lost" },
];

export interface DemoSalesChain {
  projectKey: string;
  customerName: string;
  customerEmail: string;
  agentKey: string;
  downPaymentPct: number;
  installmentCount: number;
  cadence: "monthly" | "quarterly" | "semi-annual" | "annual";
  startDate: string;
  /** How many of the generated installments (down payment first) to mark fully paid. */
  paidCount: number;
  /** How many installments right after the paid ones to flag `overdue` (unpaid, past due). */
  overdueCount?: number;
}

/**
 * Reservation → signed contract → payment plan chains seeded across every
 * `DEMO_PROJECTS` entry, two accounts each (three for North Hills, counting
 * the one hard-coded in demo-seeder.ts), so the dashboard's "Due vs.
 * Collected by Project" gets a full 5-bar spread and "Collection Rate" a
 * full 5-point line. Collection progress varies by project — including one
 * early-bird deposit on the still pre-launch West Avenue — to read as a real
 * portfolio rather than a uniform demo.
 */
export const DEMO_SALES_CHAINS: DemoSalesChain[] = [
  // North Hills already gets one chain hard-coded in demo-seeder.ts (Karim
  // Abdelrahman); these are two more units in the same project, further along.
  { projectKey: "north-hills", customerName: "Dina Aboulnaga", customerEmail: "dina.a@example.com", agentKey: "ahmed", downPaymentPct: 10, installmentCount: 16, cadence: "quarterly", startDate: "2025-06-01", paidCount: 11 },
  { projectKey: "north-hills", customerName: "Sherine Kabbani", customerEmail: "sherine.k@example.com", agentKey: "sara", downPaymentPct: 15, installmentCount: 12, cadence: "quarterly", startDate: "2025-03-01", paidCount: 8 },
  { projectKey: "palm-district", customerName: "Hossam Adly", customerEmail: "hossam.a@example.com", agentKey: "sara", downPaymentPct: 15, installmentCount: 20, cadence: "quarterly", startDate: "2026-04-01", paidCount: 4 },
  { projectKey: "palm-district", customerName: "Nourhan Adel", customerEmail: "nourhan.a@example.com", agentKey: "kariman", downPaymentPct: 15, installmentCount: 16, cadence: "quarterly", startDate: "2025-09-01", paidCount: 7 },
  { projectKey: "cedar-res", customerName: "Laila Nour", customerEmail: "laila.n@example.com", agentKey: "menna", downPaymentPct: 20, installmentCount: 12, cadence: "quarterly", startDate: "2025-01-01", paidCount: 9 },
  { projectKey: "cedar-res", customerName: "Ingy Farouk", customerEmail: "ingy.f@example.com", agentKey: "ahmed", downPaymentPct: 20, installmentCount: 10, cadence: "quarterly", startDate: "2025-07-01", paidCount: 5 },
  { projectKey: "skyline", customerName: "Khaled Fahim", customerEmail: "khaled.f@example.com", agentKey: "kariman", downPaymentPct: 10, installmentCount: 16, cadence: "monthly", startDate: "2025-10-01", paidCount: 6, overdueCount: 2 },
  { projectKey: "skyline", customerName: "Bassem Kamel", customerEmail: "bassem.k@example.com", agentKey: "menna", downPaymentPct: 10, installmentCount: 12, cadence: "monthly", startDate: "2026-01-01", paidCount: 3, overdueCount: 1 },
  { projectKey: "west-ave", customerName: "Yasser Naguib", customerEmail: "yasser.n@example.com", agentKey: "kariman", downPaymentPct: 20, installmentCount: 24, cadence: "quarterly", startDate: "2026-07-01", paidCount: 1 },
];

/**
 * `realestate_projects.velocity_per_week` has no producer anywhere in the
 * app (no time-series sales-event tracking exists to compute a real rolling
 * average — see the column's own comment in `schema.ts`), so the seeder sets
 * it directly per project, consistent with the dashboard's own "Velocity"
 * insight copy (North Hills and Cedar Residences drive the lift; Skyline is
 * flat) rather than leaving every project at its schema default of 0.
 */
export const DEMO_PROJECT_VELOCITY: Record<string, number> = {
  "north-hills": 9.4,
  "cedar-res": 8.1,
  "palm-district": 5.3,
  skyline: 1.7,
  "west-ave": 0.6,
};

/** Every value below is one of the 7 recurring (surface, fg) tone pairs used across the app. */
export const DEMO_DASHBOARD_INSIGHTS = [
  {
    tag: "Velocity",
    confidence: 0.94,
    text: "Sales velocity increased this month.",
    detail: "North Hills and Cedar Residences drive most of the lift; Skyline is flat.",
    cta: "Open velocity report",
    targetRoute: "analytics/sales",
  },
  {
    tag: "Conversion",
    confidence: 0.89,
    text: "Building C has the highest conversion rate across the portfolio.",
    detail: "82% sell-through at 1.4pp above price-list average.",
    cta: "Compare buildings",
    targetRoute: "buildings",
  },
  {
    tag: "Risk",
    confidence: 0.97,
    text: "Several high-value leads have had no activity for more than 5 days.",
    detail: "Reassignment is recommended for leads assigned to already-overloaded agents.",
    cta: "Create follow-up tasks",
    targetRoute: undefined,
  },
] as const;

export interface DemoActivity {
  type: "call" | "meeting" | "viewing" | "email" | "note" | "whatsapp";
  subject: string;
  agentKey: string;
  outcome?: string;
}

/** Populates the dashboard's "Recent Activity" panel, which is otherwise empty (nothing else in the app auto-logs an activity). */
export const DEMO_ACTIVITIES: DemoActivity[] = [
  { type: "call", subject: "Called Tarek ElGohary to discuss North Hills 3-Bed pricing", agentKey: "ahmed", outcome: "Positive — moving to negotiation" },
  { type: "meeting", subject: "Site visit with Hossam Adly at Palm District", agentKey: "sara", outcome: "Requested the duplex floor plan" },
  { type: "email", subject: "Sent updated price list to Mona Fahmy", agentKey: "ahmed" },
  { type: "whatsapp", subject: "Follow-up message to Dalia Kassem re: Cedar Residences availability", agentKey: "menna" },
  { type: "note", subject: "Karim Abdelrahman signed the contract for North Hills B2-1104", agentKey: "ahmed", outcome: "Payment plan created" },
  { type: "call", subject: "Called Omar Shaker about Skyline office units", agentKey: "kariman" },
  { type: "viewing", subject: "Showed Rasha ElBanna the Palm District duplex model unit", agentKey: "kariman" },
  { type: "meeting", subject: "Negotiation session with Nesma Fathallah", agentKey: "sara", outcome: "Countered at a 4% discount" },
  { type: "note", subject: "Recorded a payment from Dina Aboulnaga", agentKey: "ahmed" },
  { type: "call", subject: "Reconnected with Ayman Ragab — confirmed lost to a competing developer", agentKey: "menna", outcome: "Marked lost" },
];

export const DEMO_FEED_INSIGHTS = [
  { tag: "Pricing", confidence: 0.88, text: "Building C sells above price list", detail: "The floor mix is a candidate for replication in Palm District.", cta: "Model the mix for another building" },
  { tag: "Collections", confidence: 0.96, text: "A portion of receivables has aged past 90 days", detail: "Concentrated in a small number of accounts.", cta: "Escalate the largest accounts" },
  { tag: "Inventory", confidence: 0.91, text: "Some units have been listed longer than 120 days", detail: "Mostly penthouses and offices.", cta: "Review pricing for aged inventory" },
] as const;
