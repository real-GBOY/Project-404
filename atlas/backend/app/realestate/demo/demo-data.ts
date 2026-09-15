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

export const DEMO_LEADS: Array<{
  name: string;
  phone: string;
  source: "referral" | "website" | "facebook" | "broker" | "exhibition" | "instagram";
  agentKey: string;
  interestText: string;
  valueEgpM: number;
}> = [
  { name: "Tarek ElGohary", phone: "+201001234567", source: "referral", agentKey: "ahmed", interestText: "North Hills · 3-Bed", valueEgpM: 4.85 },
  { name: "Hossam Adly", phone: "+201001234568", source: "website", agentKey: "sara", interestText: "Palm District · Duplex", valueEgpM: 15.2 },
  { name: "Mona Fahmy", phone: "+201001234569", source: "broker", agentKey: "ahmed", interestText: "North Hills · 4-Bed", valueEgpM: 5.6 },
  { name: "Karim Abdelrahman", phone: "+201001234570", source: "exhibition", agentKey: "menna", interestText: "Cedar Residences · 2-Bed", valueEgpM: 4.2 },
  { name: "Rania Ezzat", phone: "+201001234571", source: "instagram", agentKey: "sara", interestText: "North Hills · 2-Bed", valueEgpM: 4.6 },
  { name: "Omar Shaker", phone: "+201001234572", source: "referral", agentKey: "kariman", interestText: "Skyline · Office", valueEgpM: 11.2 },
  { name: "Yara Mostafa", phone: "+201001234573", source: "website", agentKey: "menna", interestText: "West Avenue · 1-Bed", valueEgpM: 2.9 },
  { name: "Ziad Fouad", phone: "+201001234574", source: "broker", agentKey: "kariman", interestText: "Palm District · 3-Bed", valueEgpM: 6.4 },
];

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

export const DEMO_FEED_INSIGHTS = [
  { tag: "Pricing", confidence: 0.88, text: "Building C sells above price list", detail: "The floor mix is a candidate for replication in Palm District.", cta: "Model the mix for another building" },
  { tag: "Collections", confidence: 0.96, text: "A portion of receivables has aged past 90 days", detail: "Concentrated in a small number of accounts.", cta: "Escalate the largest accounts" },
  { tag: "Inventory", confidence: 0.91, text: "Some units have been listed longer than 120 days", detail: "Mostly penthouses and offices.", cta: "Review pricing for aged inventory" },
] as const;
