import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { CLOCK, UNIT_OF_WORK, USER_PROVIDER } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IUserProvider } from "@core/contracts/index.js";
import type { Principal } from "@core/http/principal.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { admitDb } from "@admit/admit/db/executor.js";
import { admitId } from "@admit/admit/shared/ids.js";
import { sha256Hex, TICKET_ID_SHAPE, TOKEN_SHAPE } from "@admit/admit/shared/secrets.js";
import { EventAccess } from "@admit/admit/events/application/event-access.js";
import { EventsRepository } from "@admit/admit/events/infrastructure/events-repository.js";
import { TicketsRepository, type TicketRecord } from "@admit/admit/tickets/infrastructure/tickets-repository.js";

export type ScanResult = "ADMITTED" | "ALREADY_USED" | "INVALID";
/** Why a scan was refused. Only as much as a door scanner needs: nothing about other events beyond "not this one". */
export type InvalidReason = "unknown" | "revoked" | "other_event" | "event_closed";

export interface ScanOutcome {
  result: ScanResult;
  reason?: InvalidReason;
  ticket?: { id: string; holder: string; type: string };
  /** Only for ALREADY_USED: when and where the ticket was first used, and by whom. */
  firstCheckInAt?: Date;
  firstCheckInBy?: string;
  gate?: string;
  /** When this verdict was recorded. */
  at?: Date;
}

export interface ScanInput {
  /** The QR payload (22 characters). */
  token?: string;
  /** Manual entry: the TKT-XXXX-XXXX printed under the QR code. */
  ticketId?: string;
  eventId: string;
  gate?: string;
}

/**
 * Door check-in. The single source of truth for "was this ticket used" is a conditional UPDATE in Postgres
 * (`WHERE status = 'VALID' ... RETURNING`), so two scanners racing on one QR get exactly one ADMITTED. The caller sees green
 * only for that response. Every verdict that reaches the server is logged with who and how (QR or typed ID); "no answer"
 * (network) is the client's own state and records nothing. A ticket of another event answers "not for this event" and nothing else.
 */
@Injectable()
export class CheckinService {
  constructor(
    private readonly tickets: TicketsRepository,
    private readonly events: EventsRepository,
    private readonly access: EventAccess,
    @Inject(USER_PROVIDER) private readonly users: IUserProvider,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async scan(who: Principal, input: ScanInput): Promise<ScanOutcome> {
    return this.uow.transaction(async () => {
      await this.access.assertEvent(who, input.eventId);
      const event = await this.events.findEvent(input.eventId);
      if (!event) throw NotFound("admit.event_not_found", "Event not found.");

      const assignedGate = await this.gateFor(who.userId, event.id);
      const gate = (assignedGate || input.gate || "").slice(0, 40);
      const now = this.clock.now();
      const method = input.ticketId ? "MANUAL" : "QR";

      const log = async (result: ScanResult, ticketId: string | null, reason: InvalidReason | null) => {
        await admitDb()
          .insertInto("admit_scan_attempts")
          .values({ id: admitId("scn"), organization_id: requireOrganizationId(), event_id: event.id, ticket_id: ticketId, result, reason, method, gate, staff_id: who.userId, scanned_at: now })
          .execute();
      };
      const invalid = async (reason: InvalidReason, ticketId: string | null = null): Promise<ScanOutcome> => {
        await log("INVALID", ticketId, reason);
        return { result: "INVALID", reason, at: now };
      };

      let ticket: TicketRecord | undefined;
      if (input.ticketId) {
        const id = input.ticketId.trim().toUpperCase();
        ticket = TICKET_ID_SHAPE.test(id) ? await this.tickets.find(id) : undefined;
      } else if (input.token && TOKEN_SHAPE.test(input.token)) {
        ticket = await this.tickets.findByTokenHash(sha256Hex(input.token));
      }
      if (!ticket) return invalid("unknown");
      if (ticket.eventId !== event.id) return invalid("other_event");
      if (event.status !== "published") return invalid("event_closed", ticket.id);

      const typeName = (await this.events.listTypes([event.id])).find((t) => t.id === ticket.ticketTypeId)?.name ?? "";
      const admitted = await this.tickets.admit(ticket.id, event.id, now, gate, who.userId);
      if (admitted) {
        await log("ADMITTED", ticket.id, null);
        return { result: "ADMITTED", ticket: { id: ticket.id, holder: ticket.holderName, type: typeName }, gate, at: now };
      }
      // Lost the race or already used: re-read to tell which, from the committed row.
      const current = (await this.tickets.find(ticket.id))!;
      if (current.status === "USED") {
        await log("ALREADY_USED", ticket.id, null);
        const by = current.checkedInBy ? await this.users.getUser(current.checkedInBy) : null;
        return {
          result: "ALREADY_USED", ticket: { id: current.id, holder: current.holderName, type: typeName }, firstCheckInAt: current.checkedInAt ?? undefined,
          firstCheckInBy: by?.displayName ?? by?.email ?? undefined, gate: current.checkedInGate ?? "", at: now,
        };
      }
      return invalid("revoked", ticket.id);
    });
  }

  private async gateFor(userId: string, eventId: string): Promise<string> {
    const r = await admitDb().selectFrom("admit_event_staff").select("gate").where("event_id", "=", eventId).where("user_id", "=", userId).executeTakeFirst();
    return r?.gate ?? "";
  }

  /** The scanner's start screen: the events this person works, with the live count for each. */
  async myEvents(who: Principal) {
    return readInTenant(async () => {
      const scope = await this.access.scope(who);
      const now = this.clock.now();
      const events = (await this.events.listEvents({ ids: scope, status: ["published"] })).filter((e) => e.endsAt.getTime() > now.getTime() - 12 * 3_600_000);
      const gates = await admitDb().selectFrom("admit_event_staff").select(["event_id", "gate"]).where("user_id", "=", who.userId).execute();
      const gate = new Map(gates.map((g) => [g.event_id, g.gate]));
      const venues = await this.events.venuesByIds([...new Set(events.map((e) => e.venueId))]);
      const me = await this.users.getUser(who.userId);
      const out = [];
      for (const e of events) {
        const c = await this.tickets.countsByStatus(e.id);
        out.push({ id: e.id, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, venue: venues.get(e.venueId)?.name ?? "", gate: gate.get(e.id) ?? "", checkedIn: c.USED, remaining: c.VALID });
      }
      return { staff: { name: me?.displayName ?? me?.email ?? "", userId: who.userId }, events: out };
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
          .select(["s.id", "s.scanned_at", "s.result", "s.reason", "s.method", "s.ticket_id", "s.gate", "s.staff_id", "t.holder_name"])
          .where("s.event_id", "=", eventId)
          .orderBy("s.scanned_at", "desc")
          .limit(50)
          .execute(),
      ]);
      const tn = new Map(types.map((t) => [t.id, t.name]));
      const staff = new Map<string, string>();
      for (const id of new Set(scans.map((s) => s.staff_id).filter((v): v is string => !!v))) {
        const u = await this.users.getUser(id);
        staff.set(id, u?.displayName ?? u?.email ?? "");
      }
      return {
        event: { id: event.id, title: event.title, startsAt: event.startsAt },
        totals: { validTickets: counts.VALID + counts.USED, checkedIn: counts.USED, revoked: counts.REVOKED, remaining: counts.VALID },
        byType: byType.map((b) => ({ ticketTypeId: b.ticketTypeId, name: tn.get(b.ticketTypeId) ?? "", total: b.total, checkedIn: b.used })),
        arrivals: arrivals.map((a) => ({ at: a.at, count: a.n })),
        scans: scans.map((s) => ({ id: s.id, at: s.scanned_at, result: s.result, reason: s.reason, method: s.method, ticketId: s.ticket_id, holder: s.holder_name, gate: s.gate, staff: s.staff_id ? (staff.get(s.staff_id) ?? "") : "" })),
      };
    });
  }
}
