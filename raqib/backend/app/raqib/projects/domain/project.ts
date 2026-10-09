import type { L10n } from "@raqib/raqib/shared/l10n.js";

export type ProjectStatus = "active" | "attention" | "mobilizing" | "closed";

export interface AreaView {
  id: string;
  name: L10n;
}
export interface SiteView {
  id: string;
  name: L10n;
  areas: AreaView[];
}
export interface ProjectView {
  id: string;
  code: string;
  name: L10n;
  city: L10n;
  region: L10n;
  manager: { id: string; name: L10n } | null;
  status: ProjectStatus;
  firstVisitDate: string | null;
  contractStart: string | null;
  contractEnd: string | null;
  employeesAssigned: number | null;
  guardCount: number;
  sites: SiteView[];
}
export interface GuardView {
  id: string;
  projectId: string;
  employeeNo: string;
  /** Always masked in API responses (first four and last three digits only). */
  nationalId: string;
  name: L10n;
  post: L10n;
  shift: "morning" | "evening" | "night";
  status: "active" | "inactive";
  userId: string | null;
}

/** Keep the first four and last three digits; the middle is never sent to a client. */
export function maskNationalId(id: string): string {
  if (id.length <= 7) return "•".repeat(id.length);
  return `${id.slice(0, 4)}•••${id.slice(-3)}`;
}
