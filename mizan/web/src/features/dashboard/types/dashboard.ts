import type { Money } from "@/types/api";

export interface DashboardKpis {
  activeMatters: number;
  openedThisMonth: number;
  closedYtd: number;
  hearingsThisMonth: number;
  hearingsNext7: number;
  adjournedThisMonth: number;
  unbilledHours: number;
  /** per-currency, never summed (PLAN §6) */
  unbilledValue: Money[];
  outstanding: Money[];
  overdueInvoices: number;
  overdueAmount: Money[];
}

export interface DashboardHearing {
  id: string;
  matterId: string;
  matterNumber: string;
  matterTitle: string;
  court: string;
  scheduledAt: string;
  leadLawyer: string;
  status: "confirmed" | "awaiting_court" | "adjourned";
}

export interface DashboardDeadline {
  id: string;
  matterId: string;
  matterNumber: string;
  matterTitle: string;
  title: string;
  owner: string;
  dueAt: string;
  severity: "critical" | "warning";
}

export interface DashboardTask {
  id: string;
  title: string;
  matterTitle: string | null;
  assignee: string;
  dueAt: string | null;
  priority: "low" | "normal" | "high";
}

export interface DashboardDocument {
  id: string;
  name: string;
  matterTitle: string;
  uploadedAt: string;
  status: "awaiting_review" | "expiring" | "in_review";
}

export interface PracticeAreaSlice {
  area: string;
  matters: number;
}

/** Billing vs collections over recent months — display-only, EGP. */
export interface BillingPoint {
  month: string;
  billed: number;
  collected: number;
  currency: string;
}

export interface DashboardBilling {
  billedYtd: Money[];
  collectedYtd: Money[];
  /** 0–100 */
  collectionRate: number;
  series: BillingPoint[];
}

export interface ActivityEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
  icon: string;
}

export interface DashboardData {
  kpis: DashboardKpis;
  alert: { title: string; detail: string } | null;
  upcomingHearings: DashboardHearing[];
  urgentDeadlines: DashboardDeadline[];
  practiceAreas: PracticeAreaSlice[];
  billing: DashboardBilling;
  myTasks: DashboardTask[];
  reviewDocuments: DashboardDocument[];
  recentActivity: ActivityEntry[];
}
