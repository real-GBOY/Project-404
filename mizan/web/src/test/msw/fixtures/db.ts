/**
 * In-memory demo dataset for the mock API (decision #14 — one demo org, the
 * prototype's data). Feature handlers CRUD against this store, so actions in one
 * screen show up in another (create a matter → it appears on the dashboard).
 *
 * Dev-only. Each feature's handler file is deleted at its backend cutover; this
 * file goes when the last one does.
 */

export type Currency = "EGP" | "AED" | "USD" | "SAR";

export interface ClientRow {
  id: string;
  name: string;
  type: "company" | "individual";
  status: "active" | "archived";
  email: string | null;
  phone: string | null;
  taxId: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ContactRow {
  id: string;
  clientId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  primary: boolean;
}

export type MatterStatus = "open" | "on_hold" | "closed";

export interface MatterRow {
  id: string;
  reference: string;
  title: string;
  clientId: string;
  practiceArea: string;
  status: MatterStatus;
  court: string | null;
  leadLawyerId: string;
  openedAt: string;
  closedAt: string | null;
  description: string | null;
}

export interface ParticipantRow {
  id: string;
  matterId: string;
  userId: string;
  role: string;
}

export interface MatterUpdateRow {
  id: string;
  matterId: string;
  authorId: string;
  body: string;
  documentIds: string[];
  createdAt: string;
}

export interface NoteRow {
  id: string;
  matterId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export type HearingStatus = "scheduled" | "adjourned" | "decided";

export interface HearingRow {
  id: string;
  matterId: string;
  court: string;
  scheduledAt: string;
  status: HearingStatus;
  purpose: string;
  outcome: string | null;
}

export type TaskStatus = "todo" | "in_progress" | "done";

export interface TaskRow {
  id: string;
  title: string;
  matterId: string | null;
  assigneeId: string | null;
  status: TaskStatus;
  priority: "low" | "normal" | "high";
  dueAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DocumentRow {
  id: string;
  name: string;
  matterId: string | null;
  category: string;
  status: "draft" | "final" | "filed" | "signed";
  fileId: string;
  sizeBytes: number;
  mimeType: string;
  uploadedById: string;
  uploadedAt: string;
}

export type InvoiceStatus = "draft" | "issued" | "sent" | "paid" | "void";

export interface InvoiceLineRow {
  id: string;
  kind: "fee" | "disbursement";
  description: string;
  amount: number;
}

export interface InvoiceRow {
  id: string;
  number: string;
  clientId: string;
  matterId: string | null;
  status: InvoiceStatus;
  currency: Currency;
  issuedAt: string | null;
  dueAt: string | null;
  vatRate: number;
  lines: InvoiceLineRow[];
}

export interface PaymentRow {
  id: string;
  invoiceId: string;
  amount: number;
  currency: Currency;
  method: "bank_transfer" | "cheque" | "cash" | "card";
  receivedAt: string;
  reference: string | null;
}

export type ExpenseStatus = "pending" | "approved" | "rejected";

export interface ExpenseRow {
  id: string;
  matterId: string | null;
  description: string;
  category: string;
  amount: number;
  currency: Currency;
  status: ExpenseStatus;
  incurredAt: string;
  submittedById: string;
}

export interface TeamMemberRow {
  id: string;
  name: string;
  title: string;
  role: string;
  email: string;
  phone: string | null;
  practiceAreas: string[];
  status: "active" | "inactive";
  weeklyCapacityHours: number;
}

export interface CalendarEventRow {
  id: string;
  title: string;
  kind: "meeting" | "reminder" | "court_filing" | "other";
  startAt: string;
  endAt: string | null;
  matterId: string | null;
  ownerId: string;
}

export interface ActivityRow {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  at: string;
}

export interface LawFirmSettingsRow {
  firmName: string;
  registrationNumber: string;
  address: string;
  defaultCurrency: Currency;
  vatRate: number;
  matterTypes: string[];
  courts: string[];
  standardRates: { role: string; hourlyRate: number; currency: Currency }[];
  aiAssistantEnabled: boolean;
}

interface Db {
  clients: ClientRow[];
  contacts: ContactRow[];
  matters: MatterRow[];
  participants: ParticipantRow[];
  matterUpdates: MatterUpdateRow[];
  notes: NoteRow[];
  hearings: HearingRow[];
  tasks: TaskRow[];
  documents: DocumentRow[];
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  expenses: ExpenseRow[];
  team: TeamMemberRow[];
  events: CalendarEventRow[];
  activity: ActivityRow[];
  settings: LawFirmSettingsRow;
}

// ─── helpers ─────────────────────────────────────────────────────────────────
let seq = 0;
export const nextId = (prefix: string) => `${prefix}_${(++seq).toString(36)}${Date.now().toString(36).slice(-3)}`;

const now = Date.now();
const DAY = 86_400_000;
function iso(offsetDays: number, hour = 10): string {
  const d = new Date(now + offsetDays * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const PRACTICE_AREAS = ["Litigation", "Corporate", "Real Estate", "Employment", "Arbitration", "Tax"];
const COURTS = [
  "Cairo Economic Court",
  "Cairo Court of Appeal",
  "South Cairo Primary Court",
  "Giza Primary Court",
  "Alexandria Economic Court",
];

// ─── team ────────────────────────────────────────────────────────────────────
const team: TeamMemberRow[] = [
  { id: "usr_dev", name: "Amira Tawfik", title: "Managing Partner", role: "firm_admin", email: "amira.tawfik@tawfikpartners.eg", phone: "+20 2 2735 1200", practiceAreas: ["Corporate", "Arbitration"], status: "active", weeklyCapacityHours: 40 },
  { id: "usr_2", name: "Karim Fahmy", title: "Partner", role: "partner", email: "karim.fahmy@tawfikpartners.eg", phone: "+20 2 2735 1201", practiceAreas: ["Litigation", "Employment"], status: "active", weeklyCapacityHours: 40 },
  { id: "usr_3", name: "Nour El-Sayed", title: "Senior Associate", role: "lawyer", email: "nour.elsayed@tawfikpartners.eg", phone: null, practiceAreas: ["Real Estate", "Corporate"], status: "active", weeklyCapacityHours: 40 },
  { id: "usr_4", name: "Omar Mansour", title: "Associate", role: "lawyer", email: "omar.mansour@tawfikpartners.eg", phone: null, practiceAreas: ["Litigation", "Tax"], status: "active", weeklyCapacityHours: 40 },
  { id: "usr_5", name: "Salma Adel", title: "Paralegal", role: "paralegal", email: "salma.adel@tawfikpartners.eg", phone: null, practiceAreas: ["Litigation"], status: "active", weeklyCapacityHours: 35 },
  { id: "usr_6", name: "Hana Ibrahim", title: "Finance Manager", role: "finance", email: "hana.ibrahim@tawfikpartners.eg", phone: "+20 2 2735 1210", practiceAreas: [], status: "active", weeklyCapacityHours: 40 },
  { id: "usr_7", name: "Youssef Halim", title: "Associate", role: "lawyer", email: "youssef.halim@tawfikpartners.eg", phone: null, practiceAreas: ["Arbitration", "Corporate"], status: "inactive", weeklyCapacityHours: 40 },
];

// ─── clients ─────────────────────────────────────────────────────────────────
const clients: ClientRow[] = [
  { id: "cli_1", name: "Al-Nour Trading Co.", type: "company", status: "active", email: "legal@alnour.com.eg", phone: "+20 2 2480 5500", taxId: "204-889-113", address: "12 El-Batal Ahmed Abdel Aziz St, Mohandessin, Giza", notes: "Long-standing retainer client. Prefers weekly updates.", createdAt: iso(-540) },
  { id: "cli_2", name: "Delta Bank S.A.E.", type: "company", status: "active", email: "gc@deltabank.eg", phone: "+20 2 3336 7000", taxId: "200-114-778", address: "National Tower, Corniche El Nil, Cairo", notes: null, createdAt: iso(-420) },
  { id: "cli_3", name: "Horizon Developments", type: "company", status: "active", email: "contracts@horizondev.eg", phone: "+20 2 2519 9042", taxId: "512-330-901", address: "New Cairo, First Settlement, Cairo", notes: "Real-estate portfolio; several concurrent matters.", createdAt: iso(-300) },
  { id: "cli_4", name: "Mariam Zaki", type: "individual", status: "active", email: "mariam.zaki@gmail.com", phone: "+20 100 224 8890", taxId: null, address: "8 Road 9, Maadi, Cairo", notes: null, createdAt: iso(-210) },
  { id: "cli_5", name: "Bright Foods Manufacturing", type: "company", status: "active", email: "admin@brightfoods.eg", phone: "+20 3 4270 1180", taxId: "331-556-220", address: "Borg El Arab Industrial Zone, Alexandria", notes: null, createdAt: iso(-160) },
  { id: "cli_6", name: "Gulf Petro Logistics FZE", type: "company", status: "active", email: "legal@gulfpetro.ae", phone: "+971 4 883 2200", taxId: "AE-100-4471", address: "Jebel Ali Free Zone, Dubai, UAE", notes: "Cross-border; invoices in AED.", createdAt: iso(-120) },
  { id: "cli_7", name: "Cedar Holdings", type: "company", status: "archived", email: null, phone: null, taxId: "119-002-654", address: "Downtown, Cairo", notes: "Engagement concluded 2025.", createdAt: iso(-900) },
];

const contacts: ContactRow[] = [
  { id: "con_1", clientId: "cli_1", name: "Tarek Selim", role: "General Counsel", email: "t.selim@alnour.com.eg", phone: "+20 2 2480 5511", primary: true },
  { id: "con_2", clientId: "cli_1", name: "Rania Gamal", role: "CFO", email: "r.gamal@alnour.com.eg", phone: null, primary: false },
  { id: "con_3", clientId: "cli_2", name: "Hossam Farid", role: "Head of Legal", email: "h.farid@deltabank.eg", phone: "+20 2 3336 7042", primary: true },
  { id: "con_4", clientId: "cli_3", name: "Dina Wagdy", role: "Development Director", email: "d.wagdy@horizondev.eg", phone: null, primary: true },
  { id: "con_5", clientId: "cli_6", name: "Michael Ross", role: "Regional Legal Manager", email: "m.ross@gulfpetro.ae", phone: "+971 4 883 2214", primary: true },
];

// ─── matters ─────────────────────────────────────────────────────────────────
const matters: MatterRow[] = [
  { id: "mat_1", reference: "TP-2024-0111", title: "Al-Nour Trading v. Delta Bank — facility dispute", clientId: "cli_1", practiceArea: "Litigation", status: "open", court: "Cairo Economic Court", leadLawyerId: "usr_2", openedAt: iso(-190), closedAt: null, description: "Dispute over acceleration of a EGP 40m credit facility and enforcement of security." },
  { id: "mat_2", reference: "TP-2024-0140", title: "Horizon Developments — New Cairo land acquisition", clientId: "cli_3", practiceArea: "Real Estate", status: "open", court: null, leadLawyerId: "usr_3", openedAt: iso(-150), closedAt: null, description: "Acquisition and title due diligence for a 22,000 sqm plot." },
  { id: "mat_3", reference: "TP-2025-0007", title: "Bright Foods — distribution agreement review", clientId: "cli_5", practiceArea: "Corporate", status: "open", court: null, leadLawyerId: "usr_3", openedAt: iso(-95), closedAt: null, description: "Review and negotiation of a regional distribution agreement." },
  { id: "mat_4", reference: "TP-2025-0018", title: "Mariam Zaki — unfair dismissal claim", clientId: "cli_4", practiceArea: "Employment", status: "open", court: "South Cairo Primary Court", leadLawyerId: "usr_2", openedAt: iso(-80), closedAt: null, description: "Claim for arbitrary dismissal and unpaid end-of-service benefits." },
  { id: "mat_5", reference: "TP-2025-0026", title: "Gulf Petro — ICC arbitration (logistics contract)", clientId: "cli_6", practiceArea: "Arbitration", status: "open", court: null, leadLawyerId: "usr_1", openedAt: iso(-70), closedAt: null, description: "ICC arbitration seated in Cairo over a terminated logistics services contract." },
  { id: "mat_6", reference: "TP-2025-0031", title: "Al-Nour Trading — tax assessment appeal", clientId: "cli_1", practiceArea: "Tax", status: "open", court: "Cairo Court of Appeal", leadLawyerId: "usr_4", openedAt: iso(-60), closedAt: null, description: "Appeal against a corporate income tax reassessment for FY2023." },
  { id: "mat_7", reference: "TP-2025-0044", title: "Horizon Developments — construction contract dispute", clientId: "cli_3", practiceArea: "Litigation", status: "on_hold", court: "Giza Primary Court", leadLawyerId: "usr_2", openedAt: iso(-45), closedAt: null, description: "Contractor claim for delay damages; on hold pending settlement talks." },
  { id: "mat_8", reference: "TP-2025-0051", title: "Delta Bank — regulatory advisory (consumer lending)", clientId: "cli_2", practiceArea: "Corporate", status: "open", court: null, leadLawyerId: "usr_1", openedAt: iso(-30), closedAt: null, description: "Advisory on new central bank consumer-lending rules." },
  { id: "mat_9", reference: "TP-2025-0055", title: "Bright Foods — trademark opposition", clientId: "cli_5", practiceArea: "Corporate", status: "open", court: null, leadLawyerId: "usr_4", openedAt: iso(-18), closedAt: null, description: "Opposition to a confusingly similar trademark application." },
  { id: "mat_10", reference: "TP-2024-0090", title: "Cedar Holdings — shareholder exit", clientId: "cli_7", practiceArea: "Corporate", status: "closed", court: null, leadLawyerId: "usr_1", openedAt: iso(-800), closedAt: iso(-360), description: "Negotiated buy-out of a minority shareholder." },
];

const participants: ParticipantRow[] = [
  { id: "prt_1", matterId: "mat_1", userId: "usr_2", role: "Lead" },
  { id: "prt_2", matterId: "mat_1", userId: "usr_5", role: "Paralegal" },
  { id: "prt_3", matterId: "mat_1", userId: "usr_4", role: "Support" },
  { id: "prt_4", matterId: "mat_5", userId: "usr_1", role: "Lead" },
  { id: "prt_5", matterId: "mat_5", userId: "usr_7", role: "Support" },
  { id: "prt_6", matterId: "mat_2", userId: "usr_3", role: "Lead" },
];

const matterUpdates: MatterUpdateRow[] = [
  { id: "upd_1", matterId: "mat_1", authorId: "usr_2", body: "Filed the statement of defence. Next hearing set for the merits.", documentIds: ["doc_1"], createdAt: iso(-20) },
  { id: "upd_2", matterId: "mat_1", authorId: "usr_5", body: "Bundle of exhibits compiled and served on opposing counsel.", documentIds: [], createdAt: iso(-9) },
  { id: "upd_3", matterId: "mat_5", authorId: "usr_1", body: "Terms of reference agreed with the tribunal. Procedural timetable circulated.", documentIds: ["doc_7"], createdAt: iso(-12) },
];

const notes: NoteRow[] = [
  { id: "nte_1", matterId: "mat_1", authorId: "usr_2", body: "Client wants to avoid a public judgment — keep settlement channel open.", createdAt: iso(-30), updatedAt: iso(-30) },
  { id: "nte_2", matterId: "mat_4", authorId: "usr_2", body: "Key issue: whether the warning letters meet the procedural threshold under the Labour Law.", createdAt: iso(-15), updatedAt: iso(-14) },
];

// ─── hearings ────────────────────────────────────────────────────────────────
const hearings: HearingRow[] = [
  { id: "hrg_1", matterId: "mat_1", court: "Cairo Economic Court", scheduledAt: iso(2, 9), status: "scheduled", purpose: "Merits hearing", outcome: null },
  { id: "hrg_2", matterId: "mat_4", court: "South Cairo Primary Court", scheduledAt: iso(5, 11), status: "scheduled", purpose: "First session", outcome: null },
  { id: "hrg_3", matterId: "mat_6", court: "Cairo Court of Appeal", scheduledAt: iso(9, 10), status: "scheduled", purpose: "Expert report review", outcome: null },
  { id: "hrg_4", matterId: "mat_7", court: "Giza Primary Court", scheduledAt: iso(16, 9), status: "scheduled", purpose: "Case management", outcome: null },
  { id: "hrg_5", matterId: "mat_1", court: "Cairo Economic Court", scheduledAt: iso(-14, 9), status: "adjourned", purpose: "Merits hearing", outcome: "Adjourned at the court's motion for document review." },
  { id: "hrg_6", matterId: "mat_4", court: "South Cairo Primary Court", scheduledAt: iso(-25, 11), status: "decided", purpose: "Interim relief application", outcome: "Application for wage continuation granted." },
];

// ─── tasks ───────────────────────────────────────────────────────────────────
const tasks: TaskRow[] = [
  { id: "tsk_1", title: "Draft settlement memo for Al-Nour", matterId: "mat_1", assigneeId: "usr_dev", status: "in_progress", priority: "high", dueAt: iso(1), createdAt: iso(-4), completedAt: null },
  { id: "tsk_2", title: "Prepare hearing bundle — Mariam Zaki first session", matterId: "mat_4", assigneeId: "usr_5", status: "todo", priority: "high", dueAt: iso(3), createdAt: iso(-3), completedAt: null },
  { id: "tsk_3", title: "Review distribution agreement redlines", matterId: "mat_3", assigneeId: "usr_3", status: "todo", priority: "normal", dueAt: iso(4), createdAt: iso(-6), completedAt: null },
  { id: "tsk_4", title: "File trademark opposition grounds", matterId: "mat_9", assigneeId: "usr_4", status: "todo", priority: "normal", dueAt: iso(-1), createdAt: iso(-8), completedAt: null },
  { id: "tsk_5", title: "Collect title deeds from client — New Cairo plot", matterId: "mat_2", assigneeId: "usr_dev", status: "todo", priority: "normal", dueAt: iso(-2), createdAt: iso(-10), completedAt: null },
  { id: "tsk_6", title: "Circulate arbitration procedural timetable", matterId: "mat_5", assigneeId: "usr_1", status: "done", priority: "normal", dueAt: iso(-12), createdAt: iso(-14), completedAt: iso(-12) },
  { id: "tsk_7", title: "Respond to central bank consultation", matterId: "mat_8", assigneeId: "usr_1", status: "todo", priority: "low", dueAt: iso(12), createdAt: iso(-5), completedAt: null },
  { id: "tsk_8", title: "Update client on tax appeal status", matterId: "mat_6", assigneeId: "usr_dev", status: "todo", priority: "normal", dueAt: iso(2), createdAt: iso(-2), completedAt: null },
  { id: "tsk_9", title: "Book process server for construction claim", matterId: "mat_7", assigneeId: "usr_5", status: "todo", priority: "low", dueAt: null, createdAt: iso(-7), completedAt: null },
];

// ─── documents ───────────────────────────────────────────────────────────────
const documents: DocumentRow[] = [
  { id: "doc_1", name: "Statement of Defence — Al-Nour.pdf", matterId: "mat_1", category: "Pleading", status: "filed", fileId: "file_1", sizeBytes: 284_113, mimeType: "application/pdf", uploadedById: "usr_2", uploadedAt: iso(-20) },
  { id: "doc_2", name: "Credit Facility Agreement (2021).pdf", matterId: "mat_1", category: "Evidence", status: "final", fileId: "file_2", sizeBytes: 1_204_882, mimeType: "application/pdf", uploadedById: "usr_5", uploadedAt: iso(-40) },
  { id: "doc_3", name: "Title Search Report — Plot 22.pdf", matterId: "mat_2", category: "Report", status: "draft", fileId: "file_3", sizeBytes: 512_004, mimeType: "application/pdf", uploadedById: "usr_3", uploadedAt: iso(-6) },
  { id: "doc_4", name: "Distribution Agreement v3 (redline).docx", matterId: "mat_3", category: "Contract", status: "draft", fileId: "file_4", sizeBytes: 96_770, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", uploadedById: "usr_3", uploadedAt: iso(-3) },
  { id: "doc_5", name: "Dismissal Letter — M. Zaki.pdf", matterId: "mat_4", category: "Evidence", status: "final", fileId: "file_5", sizeBytes: 61_233, mimeType: "application/pdf", uploadedById: "usr_2", uploadedAt: iso(-16) },
  { id: "doc_6", name: "Engagement Letter — Gulf Petro.pdf", matterId: "mat_5", category: "Admin", status: "signed", fileId: "file_6", sizeBytes: 142_889, mimeType: "application/pdf", uploadedById: "usr_1", uploadedAt: iso(-70) },
  { id: "doc_7", name: "Terms of Reference — ICC.pdf", matterId: "mat_5", category: "Pleading", status: "final", fileId: "file_7", sizeBytes: 331_220, mimeType: "application/pdf", uploadedById: "usr_1", uploadedAt: iso(-12) },
  { id: "doc_8", name: "Tax Reassessment Notice FY2023.pdf", matterId: "mat_6", category: "Evidence", status: "final", fileId: "file_8", sizeBytes: 208_441, mimeType: "application/pdf", uploadedById: "usr_4", uploadedAt: iso(-58) },
  { id: "doc_9", name: "Board Resolution — Bright Foods.pdf", matterId: "mat_9", category: "Corporate", status: "draft", fileId: "file_9", sizeBytes: 44_120, mimeType: "application/pdf", uploadedById: "usr_4", uploadedAt: iso(-2) },
  { id: "doc_10", name: "Opposing Counsel Correspondence (bundle).pdf", matterId: "mat_1", category: "Correspondence", status: "final", fileId: "file_10", sizeBytes: 903_551, mimeType: "application/pdf", uploadedById: "usr_5", uploadedAt: iso(-9) },
];

// ─── invoices / payments / expenses ──────────────────────────────────────────
const invoices: InvoiceRow[] = [
  { id: "inv_1", number: "INV-2026-0128", clientId: "cli_1", matterId: "mat_1", status: "sent", currency: "EGP", issuedAt: iso(-45), dueAt: iso(-15), vatRate: 0.14, lines: [ { id: "il_1", kind: "fee", description: "Professional fees — Feb", amount: 220_000 }, { id: "il_2", kind: "disbursement", description: "Court filing fees", amount: 4_500 } ] },
  { id: "inv_2", number: "INV-2026-0134", clientId: "cli_3", matterId: "mat_2", status: "sent", currency: "EGP", issuedAt: iso(-30), dueAt: iso(0), vatRate: 0.14, lines: [ { id: "il_3", kind: "fee", description: "Due diligence — phase 1", amount: 180_000 } ] },
  { id: "inv_3", number: "INV-2026-0140", clientId: "cli_6", matterId: "mat_5", status: "issued", currency: "AED", issuedAt: iso(-10), dueAt: iso(20), vatRate: 0.05, lines: [ { id: "il_4", kind: "fee", description: "Arbitration — retainer draw", amount: 60_000 }, { id: "il_5", kind: "disbursement", description: "ICC registration fee", amount: 3_000 } ] },
  { id: "inv_4", number: "INV-2026-0141", clientId: "cli_5", matterId: "mat_3", status: "draft", currency: "EGP", issuedAt: null, dueAt: null, vatRate: 0.14, lines: [ { id: "il_6", kind: "fee", description: "Contract review", amount: 45_000 } ] },
  { id: "inv_5", number: "INV-2026-0142", clientId: "cli_1", matterId: "mat_6", status: "paid", currency: "EGP", issuedAt: iso(-60), dueAt: iso(-30), vatRate: 0.14, lines: [ { id: "il_7", kind: "fee", description: "Tax appeal — preparation", amount: 150_000 } ] },
  { id: "inv_6", number: "INV-2026-0119", clientId: "cli_2", matterId: "mat_8", status: "paid", currency: "EGP", issuedAt: iso(-80), dueAt: iso(-50), vatRate: 0.14, lines: [ { id: "il_8", kind: "fee", description: "Regulatory advisory", amount: 95_000 } ] },
];

const payments: PaymentRow[] = [
  { id: "pay_1", invoiceId: "inv_5", amount: 171_000, currency: "EGP", method: "bank_transfer", receivedAt: iso(-28), reference: "TRF-99120" },
  { id: "pay_2", invoiceId: "inv_6", amount: 108_300, currency: "EGP", method: "bank_transfer", receivedAt: iso(-47), reference: "TRF-98004" },
  { id: "pay_3", invoiceId: "inv_1", amount: 100_000, currency: "EGP", method: "cheque", receivedAt: iso(-8), reference: "CHQ-4471" },
];

const expenses: ExpenseRow[] = [
  { id: "exp_1", matterId: "mat_1", description: "Court filing fees — merits hearing", category: "Court fees", amount: 3_200, currency: "EGP", status: "approved", incurredAt: iso(-18), submittedById: "usr_5" },
  { id: "exp_2", matterId: "mat_5", description: "Expert witness retainer", category: "Experts", amount: 25_000, currency: "AED", status: "pending", incurredAt: iso(-6), submittedById: "usr_1" },
  { id: "exp_3", matterId: "mat_2", description: "Land registry search fees", category: "Disbursement", amount: 1_450, currency: "EGP", status: "approved", incurredAt: iso(-9), submittedById: "usr_3" },
  { id: "exp_4", matterId: "mat_4", description: "Process server", category: "Disbursement", amount: 900, currency: "EGP", status: "pending", incurredAt: iso(-2), submittedById: "usr_5" },
  { id: "exp_5", matterId: null, description: "Legal research subscription — quarterly", category: "Subscriptions", amount: 6_800, currency: "EGP", status: "approved", incurredAt: iso(-20), submittedById: "usr_6" },
];

const events: CalendarEventRow[] = [
  { id: "evt_1", title: "Client call — Al-Nour settlement strategy", kind: "meeting", startAt: iso(1, 14), endAt: iso(1, 15), matterId: "mat_1", ownerId: "usr_2" },
  { id: "evt_2", title: "Internal review — arbitration timetable", kind: "meeting", startAt: iso(3, 12), endAt: iso(3, 13), matterId: "mat_5", ownerId: "usr_1" },
  { id: "evt_3", title: "Deadline: file opposition grounds", kind: "court_filing", startAt: iso(-1, 17), endAt: null, matterId: "mat_9", ownerId: "usr_4" },
  { id: "evt_4", title: "Deadline: submit expert report", kind: "reminder", startAt: iso(7, 17), endAt: null, matterId: "mat_6", ownerId: "usr_4" },
];

const activity: ActivityRow[] = [
  { id: "act_1", actorId: "usr_2", action: "matter.update_added", targetType: "matter", targetId: "mat_1", targetLabel: "Al-Nour Trading v. Delta Bank", at: iso(-9) },
  { id: "act_2", actorId: "usr_5", action: "document.uploaded", targetType: "document", targetId: "doc_10", targetLabel: "Opposing Counsel Correspondence (bundle).pdf", at: iso(-9) },
  { id: "act_3", actorId: "usr_1", action: "hearing.scheduled", targetType: "hearing", targetId: "hrg_1", targetLabel: "Merits hearing — Al-Nour", at: iso(-11) },
  { id: "act_4", actorId: "usr_6", action: "payment.recorded", targetType: "payment", targetId: "pay_3", targetLabel: "EGP 100,000 against INV-2026-0128", at: iso(-8) },
  { id: "act_5", actorId: "usr_3", action: "matter.opened", targetType: "matter", targetId: "mat_9", targetLabel: "Bright Foods — trademark opposition", at: iso(-18) },
  { id: "act_6", actorId: "usr_4", action: "task.completed", targetType: "task", targetId: "tsk_6", targetLabel: "Circulate arbitration procedural timetable", at: iso(-12) },
];

const settings: LawFirmSettingsRow = {
  firmName: "Mizan",
  registrationNumber: "EG-LAW-2009-0447",
  address: "Nile City Towers, North Tower, 21st Floor, Corniche El Nil, Cairo",
  defaultCurrency: "EGP",
  vatRate: 0.14,
  matterTypes: PRACTICE_AREAS,
  courts: COURTS,
  standardRates: [
    { role: "Managing Partner", hourlyRate: 4500, currency: "EGP" },
    { role: "Partner", hourlyRate: 3500, currency: "EGP" },
    { role: "Senior Associate", hourlyRate: 2200, currency: "EGP" },
    { role: "Associate", hourlyRate: 1500, currency: "EGP" },
    { role: "Paralegal", hourlyRate: 700, currency: "EGP" },
  ],
  aiAssistantEnabled: true,
};

export const db: Db = {
  clients,
  contacts,
  matters,
  participants,
  matterUpdates,
  notes,
  hearings,
  tasks,
  documents,
  invoices,
  payments,
  expenses,
  team,
  events,
  activity,
  settings,
};

/** Pristine snapshot — used to reset mutations between tests. */
const SEED = structuredClone(db);

/** Restore the dataset to its seeded state (called from test setup's afterEach). */
export function resetDb(): void {
  Object.assign(db, structuredClone(SEED));
  seq = 0;
}

export const CURRENT_USER_ID = "usr_dev";

/** Client / matter / user lookups by id — handlers denormalise for responses. */
export const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? "—";
export const matterTitle = (id: string | null) =>
  id ? (db.matters.find((m) => m.id === id)?.title ?? "—") : null;
export const matterRef = (id: string | null) =>
  id ? (db.matters.find((m) => m.id === id)?.reference ?? "—") : null;
export const userName = (id: string | null) =>
  id ? (db.team.find((u) => u.id === id)?.name ?? "—") : null;

/** Server-authoritative invoice totals (decision #9). */
export function invoiceTotals(inv: InvoiceRow) {
  const fees = inv.lines.filter((l) => l.kind === "fee").reduce((s, l) => s + l.amount, 0);
  const disbursements = inv.lines
    .filter((l) => l.kind === "disbursement")
    .reduce((s, l) => s + l.amount, 0);
  const vat = Math.round(fees * inv.vatRate);
  const total = fees + disbursements + vat;
  const paid = db.payments
    .filter((p) => p.invoiceId === inv.id)
    .reduce((s, p) => s + p.amount, 0);
  return { fees, disbursements, vat, total, paid, balance: total - paid };
}
