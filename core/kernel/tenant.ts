import type { ITenantContext } from "@core/contracts/index.js";
import { Unauthenticated } from "./errors.js";
import { getContext } from "@core/kernel/logging/context.js";

/**
 * Reading the active tenant off the ambient request context (§ docs/tenancy.md).
 *
 * The context is set by the auth hook from the JWT `org` claim (checked against
 * membership). RLS is the enforcement backstop; these helpers are for the code
 * paths that must *name* the tenant — writing an `organization_id`, or refusing
 * a request that has no tenant at all.
 */

/** The active tenant, or null (orgless token, pre-tenant request, system work). */
export function currentOrganizationId(): string | null {
  return getContext()?.organizationId ?? null;
}

/** True for signup / webhook / outbox-worker paths that run on `auric_system`. */
export function isSystemContext(): boolean {
  return getContext()?.system === true;
}

/** The active tenant, or a 401 if the request carries none. */
export function requireOrganizationId(): string {
  const org = currentOrganizationId();
  if (!org) {
    throw Unauthenticated(
      "tenant.required",
      "This action requires an active organization. Select one and retry.",
    );
  }
  return org;
}

/** The ITenantContext contract (§4), backed by the ambient request context. */
export const tenantContext: ITenantContext = {
  organizationId: requireOrganizationId,
  organizationIdOrNull: currentOrganizationId,
};
