import { httpClient } from "@/lib/api/http-client";

export type DocumentStatus = "draft" | "final" | "filed" | "signed";

export interface DocRow {
  id: string;
  name: string;
  matterId: string | null;
  matterTitle: string | null;
  matterReference: string | null;
  category: string;
  status: DocumentStatus;
  sizeBytes: number;
  mimeType: string;
  uploadedBy: string | null;
  uploadedAt: string;
}

export interface DocumentsSummary {
  total: number;
  awaitingReview: number;
  expiring: number;
  addedThisMonth: number;
}

export interface DocListParams {
  matterId?: string;
  q?: string;
  category?: string;
  status?: DocumentStatus | "all";
}

export const documentKeys = {
  all: ["documents"] as const,
  list: (p: DocListParams) => [...documentKeys.all, "list", p] as const,
};

export const listDocuments = (p: DocListParams, signal?: AbortSignal) =>
  httpClient<{ items: DocRow[]; total: number }>("/documents", {
    query: { matterId: p.matterId, q: p.q, category: p.category, status: p.status },
    signal,
  });

export const uploadDocument = (form: FormData) =>
  httpClient<DocRow>("/documents", { method: "POST", form });

export const downloadDocumentPath = (id: string) => `/documents/${id}/download`;

export const updateDocument = (id: string, body: Partial<Pick<DocRow, "name" | "category" | "status">>) =>
  httpClient<DocRow>(`/documents/${id}`, { method: "PATCH", body });

export const deleteDocument = (id: string) =>
  httpClient<void>(`/documents/${id}`, { method: "DELETE" });

export const CATEGORIES = [
  "Pleading",
  "Evidence",
  "Contract",
  "Correspondence",
  "Report",
  "Corporate",
  "Admin",
  "Other",
] as const;
