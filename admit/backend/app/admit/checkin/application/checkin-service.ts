import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { Principal } from "@core/http/principal.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { admitDb } from "@admit/admit/db/executor.js";
import { admitId } from "@admit/admit/shared/ids.js";
import { sha256Hex, TOKEN_SHAPE } from "@admit/admit/shared/secrets.js";
import { EventAccess } from "@admit/admit/events/application/event-access.js";
import { EventsRepository } from "@admit/admit/events/infrastructure/events-repository.js";
import { TicketsRepository } from "@admit/admit/tickets/infrastructure/tickets-repository.js";

export type ScanResult = "ADMITTED" | "ALREADY_USED" | "INVALID";

export interface ScanOutcome {
  result: ScanResult;
  ticket?: { id: string; holder: string; type: string };
  /** Only for ALREADY_USED: when and where the ticket was first used. */
  firstCheckInAt?: Date;
  gate?: string;
}

/**
 * Door check-in. The single source of truth for "was this ticket used" is a conditional UPDATE in Postgres
 * (`WHERE status = 'VALID' ... RETURNING`), so two scanners racing on one QR get exactly one ADMITTED. The caller sees green
 * only for that response. Every verdict that reaches the server is logged; "no answer" (network) is the client's own state and
 * records nothing. An unknown token, a revoked ticket, a ticket of another event and a cancelled event all answer INVALID alike,
 * so a scanner cannot be used to learn about other events.
 */
@Injectable()
export class CheckinService {
  constructor(
    private readonly tickets: TicketsRepository,
    private readonly events: EventsRepository,
    private readonly access: EventAccess,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async scan(who: Principal, input: { token: string; eventId: string; gate?: string }): Promise<ScanOutcome> {
    return this.uow.transaction(async () => {
      await this.access.assertEvent(who, input.eventId);
      const event = await this.events.findEvent(input.eventId);
      if (!event) throw NotFound("admit.event_not_found", "Event not found.");

      const assignedGate = await this.gateFor(who.userId, event.id);
      const gate = (assignedGate || input.gate || "").slice(0, 40);
      const now = this.clock.now();

      const log = async (result: ScanResult, ticketId: string | null) => {
        await admitDb()
          .insertInto("admit_scan_attempts")
          .values({ id: admitId("scn"), organization_id: requireOrganizationId(), event_id: event.id, ticket_id: ticketId, result, gate, staff_id: who.userId, scanned_at: now })
          .execute();
      };

      const ticket = TOKEN_SHAPE.test(input.token) && event.status === "published" ? await this.tickets.findByTokenHash(sha256Hex(input.token)) : undefined;
      if (!ticket || ticket.eventId !== event.id) {
        await log("INVALID", null);
        return { result: "INVALID" };
      }
      const typeName = (await this.events.listTypes([event.id])).find((t) => t.id === ticket.ticketTypeId)?.name ?? "";

      const admitted = await this.tickets.admit(ticket.id, event.id, now, gate, who.userId);
      if (admitted) {
        await log("ADMITTED", ticket.id);
        return { result: "ADMITTED", ticket: { id: ticket.id, holder: ticket.holderName, type: typeName } };
      }
      // Lost the race or already used: re-read to tell which, from the committed row.
      const current = (await this.tickets.find(ticket.id))!;
      if (current.status === "USED") {
        await log("ALREADY_USED", ticket.id);
        return { result: "ALREADY_USED", ticket: { id: current.id, holder: current.holderName, type: typeName }, firstCheckInAt: current.checkedInAt ?? undefined, gate: current.checkedInGate ?? "" };
      }
      await log("INVALID", ticket.id); // revoked
      return { result: "INVALID" };
    });
  }

  private async gateFor(userId: string, eventId: string): Promise<string> {
    const r = await admitDb().selectFrom("admit_event_staff").select("gate").where("event_id", "=", eventId).where("user_id", "=", userId).executeTakeFirst();
    return r?.gate ?? "";
  }

  /** The scanner's start screen: the events this person works. */
  async myEvents(who: Principal) {
    return readInTenant(async () => {
      const scope = await this.access.scope(who);
      const now = this.clock.now();
      const events = (await this.events.listEvents({ ids: scope, status: ["published"] })).filter((e) => e.endsAt.getTime() > now.getTime() - 12 * 3_600_000);
      const gates = await admitDb().selectFrom("admit_event_staff").select(["event_id", "gate"]).where("user_id", "=", who.userId).execute();
      const gate = new Map(gates.map((g) => [g.event_id, g.gate]));
      return events.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, gate: gate.get(e.id) ?? "" }));
    });
  }

  async overview(who: Principal, eventId: string) {
    return readInTenant(async () => {
      await this.access.assertEvent(who, eventId);
      const event = await this.events.findEvent(eventId);
      if (!event) throw NotFound("admit.event_not_found", "Event not found.");
      const [counts, byType, types, arrivals, scans] = await Promise.all([
        this.tickets.countsByStatus(eventId),
        this.tickets.countsByType(eventId),
        this.events.listTypes([eventId]),
        this.tickets.arrivals(eventId),
        admitDb()
          .selectFrom("admit_scan_attempts as s")
          .leftJoin("admit_tickets as t", "t.id", "s.ticket_id")
          .select(["s.id", "s.scanned_at", "s.result", "s.ticket_id", "s.gate", "t.holder_name"])
          .where("s.event_id", "=", eventId)
          .orderBy("s.scanned_at", "desc")
          .limit(50)
          .execute(),
      ]);
      const tn = new Map(types.map((t) => [t.id, t.name]));
      return {
        event: { id: event.id, title: event.title, startsAt: event.startsAt },
        totals: { validTickets: counts.VALID + counts.USED, checkedIn: counts.USED, revoked: counts.REVOKED, remaining: counts.VALID },
        byType: byType.map((b) => ({ ticketTypeId: b.ticketTypeId, name: tn.get(b.ticketTypeId) ?? "", total: b.total, checkedIn: b.used })),
        arrivals: arrivals.map((a) => ({ at: a.at, count: a.n })),
        scans: scans.map((s) => ({ id: s.id, at: s.scanned_at, result: s.result, ticketId: s.ticket_id, holder: s.holder_name, gate: s.gate })),
      };
    });
  }
}
