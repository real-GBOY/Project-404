import type { Json } from "./json.js";
import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type audit_logs = {
    id: string;
    /**
     * The tenant the audited action happened in (§ docs/tenancy.md). NULL for
     * system / cross-tenant actions (cron, the outbox worker, platform support).
     * Plain column, no FK — the trail must outlive an organization's deletion.
     */
    organization_id: string | null;
    actor_id: string | null;
    /**
     * @kyselyType('user' | 'system')
     */
    actor_type: Generated<'user' | 'system'>;
    action: string;
    resource_type: string;
    resource_id: string | null;
    /**
     * @kyselyType(Json<unknown>)
     */
    before: Json<unknown> | null;
    /**
     * @kyselyType(Json<unknown>)
     */
    after: Json<unknown> | null;
    /**
     * @kyselyType(Json<Record<string, unknown>>)
     */
    metadata: Json<Record<string, unknown>> | null;
    correlation_id: string | null;
    created_at: Generated<Timestamp>;
};
export type dead_letter_messages = {
    id: string;
    organization_id: string | null;
    outbox_id: string;
    event_name: string;
    /**
     * @kyselyType(Json<Record<string, unknown>>)
     */
    payload: Json<Record<string, unknown>>;
    attempts: number;
    last_error: string;
    /**
     * @kyselyType(Json<Array<{ at: string; error: string }>>)
     */
    retry_history: Generated<Json<Array<{ at: string; error: string }>>>;
    created_at: Generated<Timestamp>;
    replayed_at: Timestamp | null;
};
export type files = {
    id: string;
    /**
     * The tenant that owns this file (§ docs/tenancy.md). RLS-scoped. Plain
     * column, no FK — file metadata must outlive an organization's deletion.
     */
    organization_id: string;
    storage_key: string;
    driver: string;
    original_name: string;
    content_type: string;
    /**
     * @kyselyType(number)
     */
    byte_size: number;
    checksum_sha256: string;
    owner_id: string | null;
    /**
     * Coarse access scope; fine-grained checks are done via RBAC in the use case.
     * @kyselyType('private' | 'public')
     */
    visibility: Generated<'private' | 'public'>;
    /**
     * @kyselyType(Json<Record<string, unknown>>)
     */
    metadata: Json<Record<string, unknown>> | null;
    created_at: Generated<Timestamp>;
    deleted_at: Timestamp | null;
};
export type notification_templates = {
    id: string;
    key: string;
    locale: string;
    /**
     * @kyselyType('in_app' | 'email')
     */
    channel: 'in_app' | 'email';
    subject: string | null;
    body: string;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type notifications = {
    id: string;
    user_id: string;
    /**
     * The tenant this notification belongs to (§ docs/tenancy.md). NULL for
     * account-level notifications (welcome, security, invitations) that are not
     * scoped to one organization — those stay visible to the user in any tenant.
     */
    organization_id: string | null;
    type: string;
    title: string;
    body: string;
    locale: string;
    /**
     * @kyselyType(Json<Record<string, unknown>>)
     */
    data: Json<Record<string, unknown>> | null;
    read_at: Timestamp | null;
    created_at: Generated<Timestamp>;
};
export type organization_members = {
    id: string;
    organization_id: string;
    user_id: string;
    /**
     * Free-form membership role label, distinct from RBAC roles.
     */
    membership_role: Generated<string>;
    joined_at: Generated<Timestamp>;
};
export type organizations = {
    id: string;
    name: string;
    slug: string;
    /**
     * @kyselyType(Json<Record<string, unknown>>)
     */
    settings: Generated<Json<Record<string, unknown>>>;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type outbox_messages = {
    id: string;
    /**
     * The tenant the originating action belonged to (§ docs/tenancy.md). The
     * worker runs system-context and re-sets `app.organization_id` from this
     * value before invoking each message's handlers. NULL for system events.
     */
    organization_id: string | null;
    event_name: string;
    /**
     * @kyselyType(Json<Record<string, unknown>>)
     */
    payload: Json<Record<string, unknown>>;
    /**
     * @kyselyType('pending' | 'processing' | 'delivered' | 'failed')
     */
    status: Generated<'pending' | 'processing' | 'delivered' | 'failed'>;
    attempts: Generated<number>;
    max_attempts: number;
    next_attempt_at: Generated<Timestamp>;
    last_error: string | null;
    locked_at: Timestamp | null;
    created_at: Generated<Timestamp>;
    delivered_at: Timestamp | null;
};
export type permissions = {
    id: string;
    /**
     * "<action>:<resource>", e.g. "employee:create".
     */
    key: string;
    action: string;
    resource: string;
    description: string | null;
    created_at: Generated<Timestamp>;
};
export type refresh_tokens = {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Timestamp;
    revoked_at: Timestamp | null;
    /**
     * Set when this token was consumed by a rotation, pointing at its successor.
     */
    rotated_to: string | null;
    user_agent: string | null;
    created_at: Generated<Timestamp>;
};
export type role_permissions = {
    role_id: string;
    permission_id: string;
};
export type roles = {
    id: string;
    key: string;
    name: string;
    description: string | null;
    is_system: Generated<boolean>;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type user_roles = {
    user_id: string;
    role_id: string;
    /**
     * The tenant this grant applies in (§ docs/tenancy.md). A user can hold
     * different roles in different organizations. RLS-scoped.
     */
    organization_id: string;
    granted_at: Generated<Timestamp>;
    granted_by: string | null;
};
export type users = {
    id: string;
    email: string;
    email_normalized: string;
    password_hash: string;
    display_name: string | null;
    /**
     * @kyselyType('active' | 'pending' | 'disabled')
     */
    status: Generated<'active' | 'pending' | 'disabled'>;
    email_verified_at: Timestamp | null;
    locale: string | null;
    created_at: Generated<Timestamp>;
    updated_at: Generated<Timestamp>;
};
export type verification_tokens = {
    id: string;
    user_id: string;
    /**
     * @kyselyType('email_verification' | 'password_reset')
     */
    purpose: 'email_verification' | 'password_reset';
    token_hash: string;
    expires_at: Timestamp;
    consumed_at: Timestamp | null;
    created_at: Generated<Timestamp>;
};
export type Database = {
    audit_logs: audit_logs;
    dead_letter_messages: dead_letter_messages;
    files: files;
    notification_templates: notification_templates;
    notifications: notifications;
    organization_members: organization_members;
    organizations: organizations;
    outbox_messages: outbox_messages;
    permissions: permissions;
    refresh_tokens: refresh_tokens;
    role_permissions: role_permissions;
    roles: roles;
    user_roles: user_roles;
    users: users;
    verification_tokens: verification_tokens;
};
