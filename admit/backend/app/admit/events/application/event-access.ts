import { Inject, Injectable } from "@nestjs/common";
import { Forbidden, NotFound } from "@core/kernel/errors.js";
import { PERMISSION_PROVIDER } from "@core/kernel/tokens.js";
import type { IPermissionProvider } from "@core/contracts/index.js";
import type { Principal } from "@core/http/principal.js";
import { EventsRepository } from "../infrastructure/events-repository.js";

/**
 * Which events a signed-in person may work. Core RBAC answers "may this person do X at all"; this
 * adds the Admit rule on top: unless they hold `read_all:event` they only reach the events they
 * are assigned to (`admit_event_staff`). Every admin service asks here, so no endpoint can forget
 * the per-event boundary. Call inside a tenant transaction.
 */
@Injectable()
export class EventAccess {
  constructor(
    private readonly repo: EventsRepository,
    @Inject(PERMISSION_PROVIDER) private readonly permissions: IPermissionProvider,
  ) {}

  /** `null` = every event of the organizer, otherwise exactly these event ids. */
  async scope(who: Principal): Promise<string[] | null> {
    if (await this.permissions.can(who.userId, "read_all", "event")) return null;
    return this.repo.assignedEventIds(who.userId);
  }

  /** 404 (not 403) for an event outside the caller's reach: its existence is not theirs to learn. */
  async assertEvent(who: Principal, eventId: string): Promise<void> {
    const scope = await this.scope(who);
    if (scope && !scope.includes(eventId)) throw NotFound("admit.event_not_found", "Event not found.");
  }

  async can(who: Principal, action: string, resource: string): Promise<boolean> {
    return this.permissions.can(who.userId, action, resource);
  }

  async require(who: Principal, action: string, resource: string): Promise<void> {
    if (!(await this.can(who, action, resource))) throw Forbidden("auth.forbidden", `Missing permission: ${action}:${resource}`);
  }
}
