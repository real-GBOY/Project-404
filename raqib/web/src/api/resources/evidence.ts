import { API_BASE_URL, ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { PresignResponse } from "@/services/upload";
import type { EvidenceItem } from "../types";

export const evidenceApi = {
  presign: (file: { name: string; type: string; size: number }) =>
    http<PresignResponse>(ENDPOINTS.files.presign, {
      method: "POST",
      body: {
        originalName: file.name,
        contentType: file.type || "application/octet-stream",
        byteSize: file.size,
      },
    }),
  confirm: (fileId: string) => http<unknown>(ENDPOINTS.files.confirm(fileId), { method: "POST" }),
  attach: (b: {
    fileId: string;
    inspectionId?: string;
    actionId?: string;
    itemId?: string | null;
    guardId?: string | null;
  }) => http<EvidenceItem>(ENDPOINTS.evidence.attach, { method: "POST", body: b }),
  remove: (id: string) => http<void>(ENDPOINTS.evidence.byId(id), { method: "DELETE" }),
  /** The bytes, fetched with the caller's credentials (never a public URL). */
  blob: async (id: string): Promise<Blob> => {
    const r = await fetch(`${API_BASE_URL}${ENDPOINTS.evidence.content(id)}`, {
      headers: http.bearerHeaders(),
    });
    if (!r.ok) throw new Error(`evidence ${r.status}`);
    return r.blob();
  },
};
