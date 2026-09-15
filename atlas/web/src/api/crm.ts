import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, patch, ENDPOINTS } from "@/config";
import { formatEgp } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { titleCase } from "@/lib/text";

// ---------- Leads ----------

export type LeadSource = "referral" | "website" | "facebook" | "broker" | "exhibition" | "instagram";
export type LeadStatus = "new" | "qualified" | "contacted" | "viewing" | "negotiation" | "lost";
export type LeadStage = LeadStatus | "reserved" | "contracted" | "sold";

export interface LeadRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: LeadSource;
  status: LeadStatus;
  stage: LeadStage;
  score: number;
  interestUnitId: string | null;
  interestText: string | null;
  valueEgp: number;
  agentId: string;
  probabilityPct: string | null;
  expectedCloseDate: string | null;
  lastActivityAt: string;
  createdAt: string;
}

export interface CreateLeadBody {
  name: string;
  phone: string;
  email?: string | null;
  source: LeadSource;
  agentId: string;
  interestText?: string | null;
  valueEgp?: number;
}

export interface LeadListParams {
  status?: LeadStatus;
  stage?: LeadStage;
  agentId?: string;
  dealsOnly?: boolean;
}

export function useLeads(params?: LeadListParams) {
  return useQuery({
    queryKey: ["leads", params ?? {}],
    queryFn: () => get<LeadRow[]>(ENDPOINTS.leads.list, params),
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLeadBody) => post<LeadRow>(ENDPOINTS.leads.list, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<{ status: LeadStatus; stage: LeadStage; score: number; valueEgp: number; agentId: string }> }) =>
      patch<LeadRow>(ENDPOINTS.leads.byId(id), body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useTrackAsDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, probabilityPct, expectedCloseDate }: { id: string; probabilityPct: number; expectedCloseDate: string }) =>
      post<LeadRow>(ENDPOINTS.leads.trackAsDeal(id), { probabilityPct, expectedCloseDate }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export interface LeadView {
  id: string;
  name: string;
  phone: string;
  source: string;
  status: string;
  stage: LeadStage;
  score: number;
  interest: string;
  value: string;
  agent: string;
  lastActivity: string;
}

export function toLeadView(row: LeadRow, agentName: (id: string) => string): LeadView {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    source: titleCase(row.source),
    status: titleCase(row.status),
    stage: row.stage,
    score: row.score,
    interest: row.interestText ?? "—",
    value: formatEgp(row.valueEgp),
    agent: agentName(row.agentId),
    lastActivity: timeAgo(row.lastActivityAt),
  };
}

// ---------- Customers ----------

export type CustomerStatus = "active" | "pending";

export interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  primaryProjectId: string | null;
  agentId: string;
  status: CustomerStatus;
  sinceDate: string;
  nationalId: string | null;
  address: string | null;
  createdAt: string;
  unitsOwned: number;
  portfolioEgp: number;
  collectedEgp: number;
}

export interface CreateCustomerBody {
  name: string;
  email?: string | null;
  phone?: string | null;
  primaryProjectId?: string | null;
  agentId: string;
  nationalId?: string | null;
  address?: string | null;
}

export function useCustomers() {
  return useQuery({ queryKey: ["customers"], queryFn: () => get<CustomerRow[]>(ENDPOINTS.customers.list) });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ["customers", id],
    queryFn: () => get<CustomerRow & { unitsOwned: string[] }>(ENDPOINTS.customers.byId(id!)),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCustomerBody) => post<CustomerRow>(ENDPOINTS.customers.list, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export interface CustomerView {
  id: string;
  name: string;
  email: string;
  phone: string;
  primaryProject: string;
  unitsOwned: number;
  portfolioValue: string;
  collected: string;
  agent: string;
  status: "Active" | "Pending";
}

export function toCustomerView(row: CustomerRow, agentName: (id: string) => string, projectName: (id: string | null) => string): CustomerView {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? "—",
    phone: row.phone ?? "—",
    primaryProject: projectName(row.primaryProjectId),
    unitsOwned: row.unitsOwned,
    portfolioValue: formatEgp(row.portfolioEgp),
    collected: formatEgp(row.collectedEgp),
    agent: agentName(row.agentId),
    status: row.status === "active" ? "Active" : "Pending",
  };
}

// ---------- Activities ----------

export type ActivityType = "call" | "meeting" | "viewing" | "email" | "note" | "whatsapp";

export interface ActivityRow {
  id: string;
  type: ActivityType;
  subject: string;
  relatedType: "lead" | "customer" | null;
  relatedId: string | null;
  agentId: string;
  outcome: string | null;
  occurredAt: string;
}

export interface CreateActivityBody {
  type: ActivityType;
  subject: string;
  relatedType?: "lead" | "customer" | null;
  relatedId?: string | null;
  agentId: string;
  outcome?: string | null;
}

export function useActivities(params?: { relatedType?: "lead" | "customer"; relatedId?: string }) {
  return useQuery({
    queryKey: ["activities", params ?? {}],
    queryFn: () => get<ActivityRow[]>(ENDPOINTS.activities.list, params),
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateActivityBody) => post<ActivityRow>(ENDPOINTS.activities.list, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export interface ActivityView {
  type: string;
  subject: string;
  relatedTo: string;
  agent: string;
  outcome: string;
  when: string;
}

export function toActivityView(
  row: ActivityRow,
  agentName: (id: string) => string,
  relatedName: (type: "lead" | "customer" | null, id: string | null) => string,
): ActivityView {
  return {
    type: titleCase(row.type),
    subject: row.subject,
    relatedTo: relatedName(row.relatedType, row.relatedId),
    agent: agentName(row.agentId),
    outcome: row.outcome ?? "—",
    when: timeAgo(row.occurredAt),
  };
}

// ---------- Follow-ups ----------

export type FollowupPriority = "high" | "medium" | "low";
export type FollowupStatus = "open" | "in-progress" | "overdue" | "done";

export interface FollowupRow {
  id: string;
  priority: FollowupPriority;
  leadId: string | null;
  customerId: string | null;
  reason: string;
  agentId: string;
  dueAt: string;
  status: FollowupStatus;
}

export interface CreateFollowupBody {
  priority?: FollowupPriority;
  leadId?: string | null;
  customerId?: string | null;
  reason: string;
  agentId: string;
  dueAt: string;
}

export function useFollowups() {
  return useQuery({ queryKey: ["followups"], queryFn: () => get<FollowupRow[]>(ENDPOINTS.followups.list) });
}

export function useCreateFollowup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFollowupBody) => post<FollowupRow>(ENDPOINTS.followups.list, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["followups"] }),
  });
}

export function useUpdateFollowupStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: FollowupStatus }) => patch<FollowupRow>(ENDPOINTS.followups.status(id), { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["followups"] }),
  });
}

export interface FollowupView {
  id: string;
  priority: string;
  leadOrCustomer: string;
  reason: string;
  agent: string;
  due: string;
  status: string;
}

function formatDue(dueAt: string, status: FollowupStatus): string {
  const due = new Date(dueAt);
  const now = new Date();
  if (status === "overdue") {
    const overdueDays = Math.max(1, Math.round((now.getTime() - due.getTime()) / 86_400_000));
    return `${overdueDays}d overdue`;
  }
  if (due.toDateString() === now.toDateString()) {
    return `Today ${due.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (due.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return due.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

export function toFollowupView(
  row: FollowupRow,
  agentName: (id: string) => string,
  relatedName: (leadId: string | null, customerId: string | null) => string,
): FollowupView {
  return {
    id: row.id,
    priority: titleCase(row.priority),
    leadOrCustomer: relatedName(row.leadId, row.customerId),
    reason: row.reason,
    agent: agentName(row.agentId),
    due: formatDue(row.dueAt, row.status),
    status: titleCase(row.status),
  };
}
