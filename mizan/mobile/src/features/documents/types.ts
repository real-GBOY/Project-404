export type DocumentStatus = "draft" | "final" | "filed" | "signed";

/** Ported from mizan/web/src/features/documents/api/documents.api.ts. */
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

export interface DocListParams {
  matterId?: string;
  q?: string;
  category?: string;
  status?: DocumentStatus | "all";
}

export const CATEGORIES = [
  "Pleading",
  "Evidence",
  "Contract",
  "Correspondence",
  "Report",
  "Corporate",
  "Admin",
  "Receipt",
  "Other",
] as const;
