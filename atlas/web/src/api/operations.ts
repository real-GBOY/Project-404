import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { titleCase } from "@/lib/text";

// ---------- Tasks ----------

export type TaskPriority = "high" | "medium" | "low";
export type TaskStatus = "open" | "in-progress" | "done";

export interface TaskRow {
  id: string;
  priority: TaskPriority;
  title: string;
  relatedType: string | null;
  relatedId: string | null;
  assigneeId: string;
  dueAt: string;
  status: TaskStatus;
}

export interface CreateTaskBody {
  priority?: TaskPriority;
  title: string;
  relatedType?: string | null;
  relatedId?: string | null;
  assigneeId: string;
  dueAt: string;
}

export function useTasks(params?: { assigneeId?: string; status?: TaskStatus }) {
  return useQuery({
    queryKey: ["tasks", params ?? {}],
    queryFn: () => apiFetch<TaskRow[]>(`/realestate/tasks${toQueryString(params)}`),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTaskBody) => apiFetch<TaskRow>("/realestate/tasks", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      apiFetch<TaskRow>(`/realestate/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export interface TaskView {
  id: string;
  priority: string;
  task: string;
  relatedTo: string;
  assignee: string;
  due: string;
  status: string;
}

function formatDue(dueAt: string): string {
  const due = new Date(dueAt);
  const now = new Date();
  if (due.toDateString() === now.toDateString()) return "Today";
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (due.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return due.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function toTaskView(row: TaskRow, assigneeName: (id: string) => string): TaskView {
  return {
    id: row.id,
    priority: titleCase(row.priority),
    task: row.title,
    relatedTo: row.relatedType && row.relatedId ? `${titleCase(row.relatedType)} ${row.relatedId}` : "—",
    assignee: assigneeName(row.assigneeId),
    due: formatDue(row.dueAt),
    status: titleCase(row.status),
  };
}

// ---------- Documents ----------

export type DocumentStatus = "draft" | "pending" | "verified";

export interface DocumentRow {
  id: string;
  name: string;
  docType: string;
  relatedType: string | null;
  relatedId: string | null;
  fileId: string | null;
  uploadedBy: string;
  status: DocumentStatus;
  createdAt: string;
}

export interface CreateDocumentBody {
  name: string;
  docType: string;
  relatedType?: string | null;
  relatedId?: string | null;
  uploadedBy: string;
}

export function useDocuments(params?: { relatedType?: string; relatedId?: string }) {
  return useQuery({
    queryKey: ["documents", params ?? {}],
    queryFn: () => apiFetch<DocumentRow[]>(`/realestate/documents${toQueryString(params)}`),
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDocumentBody) => apiFetch<DocumentRow>("/realestate/documents", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export interface DocumentView {
  id: string;
  name: string;
  docType: string;
  status: string;
}

export function toDocumentView(row: DocumentRow): DocumentView {
  return { id: row.id, name: row.name, docType: titleCase(row.docType), status: titleCase(row.status) };
}

// ---------- Workflows ----------

export type StepState = "done" | "current" | "pending";

export interface WorkflowStepRow {
  id: string;
  workflowId: string;
  seqNo: number;
  label: string;
  assigneeId: string | null;
  state: StepState;
}

export interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  steps: WorkflowStepRow[];
}

export interface CreateWorkflowBody {
  name: string;
  description?: string | null;
  steps: Array<{ label: string; assigneeId?: string | null }>;
}

export function useWorkflows() {
  return useQuery({ queryKey: ["workflows"], queryFn: () => apiFetch<WorkflowRow[]>("/realestate/workflows") });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWorkflowBody) => apiFetch<WorkflowRow>("/realestate/workflows", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

export function useAdvanceWorkflowStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, seqNo }: { workflowId: string; seqNo: number }) =>
      apiFetch<WorkflowRow>(`/realestate/workflows/${workflowId}/steps/${seqNo}/advance`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

// ---------- Approvals ----------

export type ApprovalKind = "discount" | "refund" | "contract" | "commission" | "other";
export type ApprovalStatus = "awaiting-approval" | "escalated" | "approved" | "rejected";

export interface ApprovalRow {
  id: string;
  kind: ApprovalKind;
  subject: string;
  relatedType: string | null;
  relatedId: string | null;
  amountEgp: number | null;
  requestedBy: string;
  stepNo: number;
  stepTotal: number;
  status: ApprovalStatus;
  createdAt: string;
}

export interface CreateApprovalBody {
  kind: ApprovalKind;
  subject: string;
  relatedType?: string | null;
  relatedId?: string | null;
  amountEgp?: number | null;
  requestedBy: string;
  stepTotal?: number;
}

export function useApprovals(status?: ApprovalStatus) {
  return useQuery({
    queryKey: ["approvals", status ?? "all"],
    queryFn: () => apiFetch<ApprovalRow[]>(`/realestate/approvals${status ? `?status=${status}` : ""}`),
  });
}

export function useCreateApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateApprovalBody) => apiFetch<ApprovalRow>("/realestate/approvals", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approvals"] }),
  });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) =>
      apiFetch<ApprovalRow>(`/realestate/approvals/${id}/decide`, { method: "POST", body: JSON.stringify({ decision }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approvals"] }),
  });
}

export interface ApprovalView {
  id: string;
  kind: string;
  subject: string;
  amount: string;
  who: string;
  step: string;
  age: string;
  status: string;
}

function ageOf(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  return `${days}d`;
}

export function toApprovalView(row: ApprovalRow, requesterName: (id: string) => string): ApprovalView {
  return {
    id: row.id,
    kind: titleCase(row.kind),
    subject: row.subject,
    amount: row.amountEgp != null ? `EGP ${row.amountEgp.toLocaleString("en-US")}` : "—",
    who: requesterName(row.requestedBy),
    step: `${row.stepNo}/${row.stepTotal}`,
    age: ageOf(row.createdAt),
    status: titleCase(row.status),
  };
}
