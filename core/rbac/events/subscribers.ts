import type { EventRegistry } from "../../events/registry.js";
import { OrganizationEvents } from "../../organizations/events/events.js";
import type { RbacService } from "../application/rbac-service.js";
import { SYSTEM_ROLES } from "../domain/role.js";

/**
 * RBAC's reactions to other modules' events (§3.3 "clear workflows").
 *
 * organization.created → the creator becomes tenant-scoped `admin`
 * (§ docs/tenancy.md). In-process: committed in the same transaction as the
 * organization row, so a new tenant always has exactly one administrator.
 */
export function registerRbacSubscribers(registry: EventRegistry, service: RbacService): void {
  registry.onInProcess(OrganizationEvents.Created, async (event) => {
    const p = event.payload as { organizationId: string; createdBy: string | null };
    if (!p.createdBy) return;
    await service.assignRole(p.createdBy, SYSTEM_ROLES.admin, p.createdBy, p.organizationId);
  });
}
