/** Who is signed in: people, roles, the permission template, sign-in and account security. */
import type { L10n } from "./common";

export type RoleKey = "qm" | "qe" | "pm" | "ins" | "gs" | "guard" | "gm";

export type ModuleKey =
  | "projects"
  | "visits"
  | "inspections"
  | "guardEval"
  | "observations"
  | "actions"
  | "training"
  | "reports"
  | "analytics"
  | "forms"
  | "users"
  | "permissions"
  | "audit"
  | "settings";

export type Template = Record<ModuleKey, string>;

export type PersonStatus = "active" | "invited" | "disabled";

export interface Person {
  id: string;
  name: L10n;
  ini: L10n;
  role: RoleKey;
  title: L10n;
  email: string;
  employeeNo: string | null;
  status: PersonStatus;
  lastActiveAt: string | null;
  /** `"all"` or the active assigned project ids. */
  scope: "all" | string[];
}

/** `/raqib/me` — the signed-in person plus their effective permission template. */
export interface Me extends Person {
  permissions: Template;
  organizationId: string;
  /** The organization's business date (YYYY-MM-DD). */
  today: string;
}

/** `/raqib/account/security` — the signed-in person's second factor, password age and the organization's session rule. */
export interface SecurityStatus {
  mfa: { enabled: boolean; pending: boolean; required: boolean; recoveryLeft: number };
  password: { changedAt: string | null; expired: boolean; minLength: number; rotateDays: number };
  sessionMinutes: number;
  setupRequired: Array<"mfa" | "password">;
}

export interface LoginResponse {
  user: { id: string; email: string };
  tokens: { accessToken: string; refreshToken: string };
}
