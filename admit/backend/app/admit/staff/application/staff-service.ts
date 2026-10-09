import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, UNIT_OF_WORK, USER_PROVIDER } from "@core/kernel/tokens.js";
import type { IAuditLogger, IUserProvider } from "@core/contracts/index.js";
import type { Principal } from "@core/http/principal.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { admitDb } from "@admit/admit/db/executor.js";
import { EventAccess } from "@admit/admit/events/application/event-access.js";
import { EventsRepository } from "@admit/admit/events/infrastructure/events-repository.js";

export interface StaffAssignment {
  userId: string;
  name: string;
  email: string;
  gate: string;
}

/**
 * Which people work which events. Core RBAC says what a person may do; this says where. A person without `read_all:event`
 * sees, reviews and scans only the events they are assigned to here. Only existing members of the organizer can be assigned.
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly events: EventsRepository,
    private readonly access: EventAccess,
    @Inject(USER_PROVIDER) private readonly users: IUserProvider,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async list(who: Principal, eventId: string): Promise<StaffAssignment[]> {
    return readInTenant(async () => {
      await this.access.assertEvent(who, eventId);
      if (!(await this.events.findEvent(eventId))) throw NotFound("admit.event_not_found", "Event not found.");
      const rows = await admitDb().selectFrom("admit_event_staff").select(["user_id", "gate"]).where("event_id", "=", eventId).orderBy("created_at").execute();
      return Promise.all(
        rows.map(async (r) => {
          const u = await this.users.getUser(r.user_id);
          return { userId: r.user_id, name: u?.displayName ?? u?.email ?? "Unknown", email: u?.email ?? "", gate: r.gate };
        }),
      );
    });
  }

  async assign(who: Principal, eventId: string, userId: string, gate: string): Promise<StaffAssignment[]> {
    await this.uow.transaction(async () => {
      await this.access.assertEvent(who, eventId);
      if (!(await this.events.findEvent(eventId))) throw NotFound("admit.event_not_found", "Event not found.");
      const member = await admitDb().selectFrom("organization_members").select("user_id").where("organization_id", "=", requireOrganizationId()).where("user_id", "=", userId).executeTakeFirst();
      if (!member) throw ValidationError("admit.not_a_member", "Add this person to the organizer first, then assign them to an event.");
      await admitDb()
        .insertInto("admit_event_staff")
        .values({ organization_id: requireOrganizationId(), event_id: eventId, user_id: userId, gate })
        .onConflict((oc) => oc.columns(["organization_id", "event_id", "user_id"]).doUpdateSet({ gate }))
        .execute();
      await this.audit.record({ actorId: who.userId, action: "admit.event_staff.assigned", resourceType: "admit_event", resourceId: eventId, after: { userId, gate } });
    });
    return this.list(who, eventId);
  }

  async remove(who: Principal, eventId: string, userId: string): Promise<void> {
    await this.uow.transaction(async () => {
      await this.access.assertEvent(who, eventId);
      await admitDb().deleteFrom("admit_event_staff").where("event_id", "=", eventId).where("user_id", "=", userId).execute();
      await this.audit.record({ actorId: who.userId, action: "admit.event_staff.removed", resourceType: "admit_event", resourceId: eventId, before: { userId } });
    });
  }
}
