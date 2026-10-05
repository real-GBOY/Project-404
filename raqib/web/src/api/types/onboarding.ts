/** Account requests and the public request page. */
import type { L10n } from "./common";

export interface AccountRequest {
  id: string;
  ref: string;
  name: string;
  email: string;
  phone: string;
  nationalId: string;
  employeeNo: string;
  department: string;
  requestedRole: "qe" | "pm" | "ins" | "gs" | "guard";
  requestedProjects: string;
  justification: string;
  declaration: { version: string; signedName: string; signedAt: string };
  status: "pending" | "approved" | "rejected";
  decidedBy: L10n | null;
  decidedAt: string | null;
  decisionReason: string | null;
  assignedRole: string | null;
  assignedProjectIds: string[];
  createdAt: string;
}

export interface PublicOnboardingInfo {
  organization: { name: string };
  projects: Array<{ id: string; name: L10n }>;
  roles: string[];
  declarationVersion: string;
}

/** What the public account-request form sends. */
export interface PublicRequestBody {
  name: string;
  email: string;
  phone: string;
  nationalId: string;
  employeeNo: string;
  department: string;
  role: string;
  projects: string;
  justification: string;
  signature: string;
  agree: boolean;
}
