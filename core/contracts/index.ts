/**
 * Core provider interfaces (§4). Domain modules depend on these, never on
 * another module's tables or concrete classes. This is what keeps modules
 * forkable and the coupling loose.
 *
 * Multi-tenant (§ docs/tenancy.md): the active tenant is ambient, not a
 * parameter on every contract. `ITenantContext` (below) is the one place it is
 * named explicitly; everywhere else RLS scopes the data and the
 * `organization_id` column carries it. `IOrganizationProvider` stays free of
 * tenant context on purpose — an organization *is* the tenant.
 */
export type { DomainEvent } from "./domain-event.js";
export { defineEvent } from "./domain-event.js";

// ─── Identity ────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  displayName: string | null;
  status: "active" | "pending" | "disabled";
  emailVerified: boolean;
  locale: string | null;
}

export interface IUserProvider {
  getUser(userId: string): Promise<User | null>;
  userExists(userId: string): Promise<boolean>;
}

// ─── Organizations ───────────────────────────────────────────────────────────
export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
}

export interface OrganizationMembership {
  organizationId: string;
  slug: string;
  name: string;
  membershipRole: string;
}

export interface IOrganizationProvider {
  getOrganization(orgId: string): Promise<Organization | null>;
  isMember(orgId: string, userId: string): Promise<boolean>;
  /** Every organization the user belongs to. Used at login to resolve the
   *  active tenant and populate the tenant switcher (§ docs/tenancy.md). */
  membershipsForUser(userId: string): Promise<OrganizationMembership[]>;
}

// ─── Tenant context ──────────────────────────────────────────────────────────
/**
 * The active tenant for the current request (§ docs/tenancy.md). A separate
 * contract, deliberately not folded into IOrganizationProvider. Most module
 * code never needs this — RLS plus the `organization_id` column handle scoping.
 * It exists for the paths that must name the tenant (per-tenant reports, cache
 * keys, writing an `organization_id`).
 */
export interface ITenantContext {
  /** The active tenant. Throws (401) if the request carries none. */
  organizationId(): string;
  /** The active tenant, or null for an orgless / pre-tenant / system request. */
  organizationIdOrNull(): string | null;
}

// ─── RBAC ────────────────────────────────────────────────────────────────────
export interface IPermissionProvider {
  can(userId: string, action: string, resource: string): Promise<boolean>;
  assignRole(userId: string, roleId: string): Promise<void>;
  /** All permission keys ("action:resource") the user holds, for token claims / UIs. */
  permissionsFor(userId: string): Promise<string[]>;
}

// ─── Notifications ───────────────────────────────────────────────────────────
export interface NotificationPayload {
  userId: string;
  /** Template key resolved per locale, or a literal title/body. */
  templateKey?: string;
  title?: string;
  body?: string;
  type: string;
  data?: Record<string, unknown>;
  channels?: Array<"in_app" | "email">;
  locale?: string;
}

export interface INotificationProvider {
  send(notification: NotificationPayload): Promise<void>;
}

// ─── Files ───────────────────────────────────────────────────────────────────
export interface FileInput {
  content: Buffer;
  originalName: string;
  contentType: string;
  ownerId?: string;
  visibility?: "private" | "public";
  metadata?: Record<string, unknown>;
}

export interface FileRef {
  id: string;
  storageKey: string;
  contentType: string;
  byteSize: number;
  originalName: string;
}

export interface IFileStorage {
  upload(file: FileInput): Promise<FileRef>;
  getUrl(fileRef: Pick<FileRef, "id">): Promise<string>;
  getContent(fileRef: Pick<FileRef, "id">): Promise<{ content: Buffer; ref: FileRef }>;
  delete(fileRef: Pick<FileRef, "id">): Promise<void>;
}

// ─── Audit ───────────────────────────────────────────────────────────────────
export interface AuditEntry {
  actorId: string | null;
  actorType?: "user" | "system";
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

export interface IAuditLogger {
  record(entry: AuditEntry): Promise<void>;
}

// ─── Events ──────────────────────────────────────────────────────────────────
import type { DomainEvent } from "./domain-event.js";

/**
 * Publish-only. A module publishes what happened; it does not know who (if
 * anyone) subscribes. Subscription is wired in the application/infrastructure
 * layer, not through this contract.
 *
 * Transaction ownership: the bus does NOT open or own a transaction. The
 * use-case layer opens the transaction and calls publish() inside it; the bus
 * runs within that boundary (§4, §6.1).
 */
export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
}
