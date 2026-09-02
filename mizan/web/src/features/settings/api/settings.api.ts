import { httpClient } from "@/lib/api/http-client";

export interface LawFirmSettings {
  firmName: string;
  registrationNumber: string;
  address: string;
  defaultCurrency: string;
  vatRate: number;
  matterTypes: string[];
  courts: string[];
  standardRates: { role: string; hourlyRate: number; currency: string }[];
  aiAssistantEnabled: boolean;
}

export interface RbacRole {
  key: string;
  name: string;
  permissions: number;
  editable: boolean;
}
export interface RbacMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}
export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  resource: string;
  at: string;
  ip: string;
}

export const settingsKeys = {
  firm: ["lawfirm-settings"] as const,
  roles: ["rbac", "roles"] as const,
  members: ["rbac", "members"] as const,
  audit: (q: string) => ["audit-logs", q] as const,
};

export const getSettings = (signal?: AbortSignal) =>
  httpClient<LawFirmSettings>("/lawfirm/settings", { signal });

export const patchSettings = (body: Partial<LawFirmSettings>) =>
  httpClient<LawFirmSettings>("/lawfirm/settings", { method: "PATCH", body });

export const getRoles = (signal?: AbortSignal) =>
  httpClient<{ items: RbacRole[] }>("/lawfirm/rbac/roles", { signal });

export const getMembers = (signal?: AbortSignal) =>
  httpClient<{ items: RbacMember[] }>("/lawfirm/rbac/members", { signal });

export const assignRole = (userId: string, role: string) =>
  httpClient<unknown>("/lawfirm/rbac/assignments", { method: "POST", body: { userId, role } });

export const getAuditLogs = (q: string, signal?: AbortSignal) =>
  httpClient<{ items: AuditEntry[]; total: number }>("/lawfirm/audit-logs", { query: { q: q || undefined }, signal });
