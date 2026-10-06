/** Projects, sites, areas and the guards assigned to them. */
import type { L10n } from "./common";

export type ProjectStatus = "active" | "attention" | "mobilizing" | "closed";

export interface Area {
  id: string;
  name: L10n;
}

export interface Site {
  id: string;
  name: L10n;
  areas: Area[];
}

export interface Project {
  id: string;
  code: string;
  name: L10n;
  city: L10n;
  region: L10n;
  manager: { id: string; name: L10n } | null;
  status: ProjectStatus;
  firstVisitDate: string | null;
  guardCount: number;
  sites: Site[];
}

export interface Guard {
  id: string;
  projectId: string;
  employeeNo: string;
  nationalId: string;
  name: L10n;
  post: L10n;
  shift: "morning" | "evening" | "night";
  status: "active" | "inactive";
  userId: string | null;
}

export interface ProjectInput {
  code: string;
  name: L10n;
  city: L10n;
  region: L10n;
  managerUserId: string | null;
  status: ProjectStatus;
  firstVisitDate: string | null;
}

export interface GuardInput {
  projectId: string;
  employeeNo: string;
  nationalId: string;
  name: L10n;
  post: L10n;
  shift: Guard["shift"];
  userId: string | null;
}
