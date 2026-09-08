import { httpClient } from "@/lib/api/http-client";
import { putToPresignedUrl, type PresignedUpload } from "@/lib/api/upload";

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

export interface CreateDocumentUploadInput {
  name: string;
  matterId: string | null;
  category: string;
  contentType: string;
  byteSize: number;
}

/**
 * Presigned document upload, three steps:
 *   1. reserve the document + a pending file, get an upload URL
 *   2. PUT the bytes straight to storage (R2, or the local loopback route)
 *   3. confirm — the API HEADs the object and marks it stored
 * The upload is not "done" until step 3 resolves.
 */
export async function uploadDocumentPresigned(
  input: CreateDocumentUploadInput,
  file: Blob,
): Promise<DocRow> {
  const { document, upload } = await httpClient<{ document: DocRow; upload: PresignedUpload }>(
    "/documents",
    { method: "POST", body: input },
  );
  await putToPresignedUrl(upload, file);
  const confirmed = await httpClient<{ document: DocRow }>(`/documents/${document.id}/confirm`, {
    method: "POST",
  });
  return confirmed.document;
}

export const downloadDocumentPath = (id: string) => `/documents/${id}/download`;
/** Same bytes as the download route, served `inline` for viewing in a frame. */
export const viewDocumentPath = (id: string) => `/documents/${id}/view`;

/** MIME types the browser can render in an <iframe> without a plugin. */
export const isInlineViewable = (mimeType: string) =>
  mimeType === "application/pdf" || mimeType.startsWith("image/") || mimeType.startsWith("text/");

export const updateDocument = (
  id: string,
  body: Partial<Pick<DocRow, "name" | "category" | "status">>,
) => httpClient<DocRow>(`/documents/${id}`, { method: "PATCH", body });

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
