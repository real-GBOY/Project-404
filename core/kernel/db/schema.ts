import type { ColumnType, Generated } from "kysely";

/**
 * The full database schema, as Kysely sees it. This is the one place the
 * shape of every table lives as a type. Each module owns its migrations
 * (core/<module>/migrations), and every table those migrations create must
 * be reflected here so repositories get compile-time checking.
 *
 * Convention: `created_at` / `updated_at` are set by the database
 * (DEFAULT now()); `updated_at` is bumped by an app-level trigger created in
 * the shared bootstrap migration.
 */

/**
 * Timestamps are read as Date and written as Date. `created_at` / `updated_at`
 * are DB-defaulted, so they are wrapped in Generated<T> at the column.
 */
type Timestamp = Date;
/**
 * JSONB column: read as parsed T. On write, a plain object may be passed
 * directly (node-postgres JSON-encodes it), but arrays and primitives must be
 * pre-stringified — so the insert/update type also accepts `string`.
 */
type Json<T> = ColumnType<T, T | string, T | string>;

export interface UsersTable {
  id: string;
  email: string;
  email_normalized: string;
  password_hash: string;
  display_name: string | null;
  status: "active" | "pending" | "disabled";
  email_verified_at: Timestamp | null;
  locale: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface RefreshTokensTable {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Timestamp;
  revoked_at: Timestamp | null;
  /** Set when this token was consumed by a rotation, pointing at its successor. */
  rotated_to: string | null;
  user_agent: string | null;
  created_at: Generated<Timestamp>;
}

export interface VerificationTokensTable {
  id: string;
  user_id: string;
  purpose: "email_verification" | "password_reset";
  token_hash: string;
  expires_at: Timestamp;
  consumed_at: Timestamp | null;
  created_at: Generated<Timestamp>;
}

export interface RolesTable {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface PermissionsTable {
  id: string;
  /** "<action>:<resource>", e.g. "employee:create". */
  key: string;
  action: string;
  resource: string;
  description: string | null;
  created_at: Generated<Timestamp>;
}

export interface RolePermissionsTable {
  role_id: string;
  permission_id: string;
}

export interface UserRolesTable {
  user_id: string;
  role_id: string;
  granted_at: Generated<Timestamp>;
  granted_by: string | null;
}

export interface OrganizationsTable {
  id: string;
  name: string;
  slug: string;
  settings: Json<Record<string, unknown>>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface OrganizationMembersTable {
  id: string;
  organization_id: string;
  user_id: string;
  /** Free-form membership role label, distinct from RBAC roles. */
  membership_role: string;
  joined_at: Generated<Timestamp>;
}

export interface AuditLogsTable {
  id: string;
  actor_id: string | null;
  actor_type: "user" | "system";
  action: string;
  resource_type: string;
  resource_id: string | null;
  before: Json<unknown> | null;
  after: Json<unknown> | null;
  metadata: Json<Record<string, unknown>> | null;
  correlation_id: string | null;
  created_at: Generated<Timestamp>;
}

export interface FilesTable {
  id: string;
  storage_key: string;
  driver: string;
  original_name: string;
  content_type: string;
  byte_size: number;
  checksum_sha256: string;
  owner_id: string | null;
  /** Coarse access scope; fine-grained checks are done via RBAC in the use case. */
  visibility: "private" | "public";
  metadata: Json<Record<string, unknown>> | null;
  created_at: Generated<Timestamp>;
  deleted_at: Timestamp | null;
}

export interface NotificationsTable {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  locale: string;
  data: Json<Record<string, unknown>> | null;
  read_at: Timestamp | null;
  created_at: Generated<Timestamp>;
}

export interface NotificationTemplatesTable {
  id: string;
  key: string;
  locale: string;
  channel: "in_app" | "email";
  subject: string | null;
  body: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface OutboxMessagesTable {
  id: string;
  event_name: string;
  payload: Json<Record<string, unknown>>;
  status: "pending" | "processing" | "delivered" | "failed";
  attempts: Generated<number>;
  max_attempts: number;
  next_attempt_at: Timestamp;
  last_error: string | null;
  locked_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  delivered_at: Timestamp | null;
}

export interface DeadLetterMessagesTable {
  id: string;
  outbox_id: string;
  event_name: string;
  payload: Json<Record<string, unknown>>;
  attempts: number;
  last_error: string;
  retry_history: Json<Array<{ at: string; error: string }>>;
  created_at: Generated<Timestamp>;
  replayed_at: Timestamp | null;
}

export interface Database {
  users: UsersTable;
  refresh_tokens: RefreshTokensTable;
  verification_tokens: VerificationTokensTable;
  roles: RolesTable;
  permissions: PermissionsTable;
  role_permissions: RolePermissionsTable;
  user_roles: UserRolesTable;
  organizations: OrganizationsTable;
  organization_members: OrganizationMembersTable;
  audit_logs: AuditLogsTable;
  files: FilesTable;
  notifications: NotificationsTable;
  notification_templates: NotificationTemplatesTable;
  outbox_messages: OutboxMessagesTable;
  dead_letter_messages: DeadLetterMessagesTable;
}
