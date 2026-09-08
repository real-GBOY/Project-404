import { File } from "expo-file-system";
import { httpClient, apiUrl } from "@/lib/api/http-client";
import { tokenStore } from "@/lib/auth/token-store";
import { ApiError } from "@/lib/api/api-error";
import type { DocRow, DocListParams } from "./types";
import type { CapturedImage, DocumentUploadFields } from "./upload";

/** The presigned upload target the API returns from a `.../uploads` call. */
export interface PresignedUpload {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
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

/**
 * Presigned document upload (mirrors mizan/web): reserve the row + a pending
 * file, PUT the bytes straight to storage, then confirm. Not "done" until the
 * confirm step resolves.
 */
export async function uploadDocumentPresigned(
  image: CapturedImage,
  fields: DocumentUploadFields,
): Promise<DocRow> {
  const file = new File(image.uri);
  const contentType = image.type || file.type || "application/octet-stream";

  const { document, upload } = await httpClient<{ document: DocRow; upload: PresignedUpload }>(
    "/documents",
    {
      method: "POST",
      body: {
        name: fields.name,
        matterId: fields.matterId,
        category: fields.category,
        contentType,
        byteSize: file.size,
      },
    },
  );

  const isAbsolute = /^https?:\/\//i.test(upload.url);
  const headers: Record<string, string> = { ...upload.headers };
  if (!isAbsolute) {
    const token = tokenStore.getAccess();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const putResult = await file.upload(isAbsolute ? upload.url : apiUrl(upload.url), {
    httpMethod: upload.method,
    headers,
    // The local loopback route expects a raw `application/octet-stream` body;
    // R2 stores whatever content type the PUT carries.
    mimeType: isAbsolute ? contentType : "application/octet-stream",
  });
  if (putResult.status < 200 || putResult.status >= 300) {
    throw new ApiError(putResult.status, {
      code: "upload.failed",
      message: "The file upload failed.",
    });
  }

  const confirmed = await httpClient<{ document: DocRow }>(`/documents/${document.id}/confirm`, {
    method: "POST",
  });
  return confirmed.document;
}

export const deleteDocument = (id: string) =>
  httpClient<void>(`/documents/${id}`, { method: "DELETE" });

/** Absolute, auth-header-free URL — `expo-file-system` attaches the bearer
 *  token itself (see `useOfflineDocuments`), unlike web's `<a href>` which
 *  relies on the browser session. */
export const downloadDocumentUrl = (id: string) => apiUrl(`/documents/${id}/download`);
