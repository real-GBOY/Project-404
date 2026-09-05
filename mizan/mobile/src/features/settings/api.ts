import { httpClient } from "@/lib/api/http-client";
import type { AuditEntry, LawFirmSettings } from "./types";

export const settingsKeys = {
  firm: ["lawfirm-settings"] as const,
  audit: (q: string) => ["audit-logs", q] as const,
};

export const getSettings = (signal?: AbortSignal) => httpClient<LawFirmSettings>("/lawfirm/settings", { signal });

export const getAuditLogs = (q: string, signal?: AbortSignal) =>
  httpClient<{ items: AuditEntry[]; total: number }>("/lawfirm/audit-logs", { query: { q: q || undefined }, signal });
