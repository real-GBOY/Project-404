/** The audit log. */
import type { L10n } from "./common";

export interface AuditEntry {
  id: string;
  at: string;
  actor: { id: string | null; name: L10n; role: string | null; system: boolean };
  action: string;
  entity: string;
  ref: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  correlationId: string | null;
}

export interface AuditResult {
  items: AuditEntry[];
  entities: string[];
  actors: Array<{ id: string; name: L10n }>;
  truncated: boolean;
}

export interface AuditQueryParams {
  q: string;
  entity: string;
  actor: string;
  from: string;
  to: string;
}
