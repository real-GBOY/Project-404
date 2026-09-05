import { httpClient, apiUrl } from "@/lib/api/http-client";
import type { DocRow, DocListParams } from "./types";

export const documentKeys = {
  all: ["documents"] as const,
  list: (p: DocListParams) => [...documentKeys.all, "list", p] as const,
};

export const listDocuments = (p: DocListParams, signal?: AbortSignal) =>
  httpClient<{ items: DocRow[]; total: number }>("/documents", {
    query: { matterId: p.matterId, q: p.q, category: p.category, status: p.status },
    signal,
  });

export const uploadDocument = (form: FormData) => httpClient<DocRow>("/documents", { method: "POST", form });

export const deleteDocument = (id: string) => httpClient<void>(`/documents/${id}`, { method: "DELETE" });

/** Absolute, auth-header-free URL — `expo-file-system` attaches the bearer
 *  token itself (see `useOfflineDocuments`), unlike web's `<a href>` which
 *  relies on the browser session. */
export const downloadDocumentUrl = (id: string) => apiUrl(`/documents/${id}/download`);
