/** The confidential reporting area. */
import type { L10n } from "./common";

export type ConfKind = "misconduct" | "violation" | "safety" | "survey";

export type ConfStatus = "new" | "under_review" | "closed";

export interface ConfAccess {
  isGM: boolean;
  grant: {
    id: string;
    level: "view" | "respond";
    scope: "all" | "standard";
    expiresAt: string;
  } | null;
  sessionUntil: string | null;
  reasons: string[];
}

export interface ConfReport {
  id: string;
  ref: string;
  kind: ConfKind;
  sensitivity: "standard" | "high";
  subject: string;
  place: string;
  status: ConfStatus;
  at: string;
  body?: string;
  files?: Array<{ id: string; name: string; mime: string; sizeBytes: number }>;
  response?: string | null;
  identity?: {
    mode: "named" | "confidential" | "anonymous";
    revealed: boolean;
    name?: L10n;
    employeeNo?: string;
  };
  canRespond?: boolean;
}

export interface ConfMine {
  ref: string;
  kind: ConfKind;
  subject: string;
  status: ConfStatus;
  at: string;
  response: string | null;
}

export interface ConfGrant {
  id: string;
  user: { id: string; name: L10n; role: string };
  level: "view" | "respond";
  scope: "all" | "standard";
  reason: string;
  grantedBy: L10n;
  grantedAt: string;
  expiresAt: string;
  status: "active" | "expired" | "revoked";
  revokedBy: L10n | null;
  revokeReason: string | null;
}

export interface ConfLogEntry {
  id: string;
  action: string;
  actor: L10n;
  reportRef: string | null;
  reason: string | null;
  device: string | null;
  at: string;
}

export interface ConfGrantee {
  id: string;
  name: L10n;
  role: string;
}
