import { Inject, Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { readInTenant } from "@core/kernel/db/db.js";
import { CLOCK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { Principal } from "@core/http/principal.js";
import { admitDb } from "@admit/admit/db/executor.js";
import { EventAccess } from "@admit/admit/events/application/event-access.js";
import { EventsRepository } from "@admit/admit/events/infrastructure/events-repository.js";

/**
 * Event reporting for the dashboard Overview and Reports screens. Pure read model over the booking tables: every number is an
 * aggregate computed at request time inside the caller's tenant and event reach, never a stored counter. Money is the sum of
 * CONFIRMED bookings only - a booking in review is a promise, not revenue.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly events: EventsRepository,
    private readonly access: EventAccess,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async overview(who: Principal, opts: { eventId?: string; days: number }) {
    return readInTenant(async () => {
      const scope = await this.access.scope(who);
      const ids = opts.eventId ? (scope && !scope.includes(opts.eventId) ? [] : [opts.eventId]) : scope;
      if (ids && !ids.length) return this.empty();

      const bookings = () => {
        let q = admitDb().selectFrom("admit_bookings as b");
        if (ids) q = q.where("b.event_id", "in", ids);
        return q;
      };
      const tickets = () => {
        let q = admitDb().selectFrom("admit_tickets as t");
        if (ids) q = q.where("t.event_id", "in", ids);
        return q;
      };

      const [byStatus, revenue, ticketStatus, pending, failedEmails, perType, perDay] = await Promise.all([
        bookings().select(["b.status", sql<string>`count(*)`.as("n")]).groupBy("b.status").execute(),
        bookings().select([sql<string>`coalesce(sum(b.total_minor), 0)`.as("sum"), "b.currency"]).where("b.status", "=", "CONFIRMED").groupBy("b.currency").execute(),
        tickets().select(["t.status", sql<string>`count(*)`.as("n")]).groupBy("t.status").execute(),
        admitDb()
          .selectFrom("admit_payment_submissions as s")
          .innerJoin("admit_bookings as b", (j) => j.onRef("b.id", "=", "s.booking_id").onRef("b.organization_id", "=", "s.organization_id"))
          .select([sql<string>`count(*)`.as("n"), sql<Date | null>`min(s.created_at)`.as("oldest")])
          .where("s.status", "=", "SUBMITTED")
          .$if(!!ids, (q) => q.where("b.event_id", "in", ids!))
          .executeTakeFirstOrThrow(),
        admitDb()
          .selectFrom("admit_email_messages as m")
          .select(sql<string>`count(*)`.as("n"))
          .where("m.status", "=", "FAILED")
          .$if(!!ids, (q) => q.where("m.booking_id", "in", admitDb().selectFrom("admit_bookings").select("id").where("event_id", "in", ids!)))
          .executeTakeFirstOrThrow(),
        admitDb()
          .selectFrom("admit_ticket_types as tt")
          .leftJoin("admit_booking_lines as l", (j) => j.onRef("l.ticket_type_id", "=", "tt.id").onRef("l.organization_id", "=", "tt.organization_id"))
          .leftJoin("admit_bookings as b", (j) => j.onRef("b.id", "=", "l.booking_id").onRef("b.organization_id", "=", "l.organization_id"))
          .select([
            "tt.id", "tt.name", "tt.event_id", "tt.quantity",
            sql<string>`coalesce(sum(l.quantity) filter (where b.status = 'CONFIRMED'), 0)`.as("sold"),
            sql<string>`coalesce(sum(l.quantity) filter (where b.status in ('AWAITING_PAYMENT','IN_REVIEW')), 0)`.as("held"),
            sql<string>`coalesce(sum(l.quantity * l.unit_price_minor) filter (where b.status = 'CONFIRMED'), 0)`.as("revenue"),
          ])
          .$if(!!ids, (q) => q.where("tt.event_id", "in", ids!))
          .groupBy(["tt.id", "tt.name", "tt.event_id", "tt.quantity"])
          .orderBy("tt.event_id")
          .orderBy("tt.sort_order")
          .execute(),
        bookings()
          .select([sql<string>`to_char(date_trunc('day', b.created_at at time zone 'Africa/Cairo'), 'YYYY-MM-DD')`.as("day"), sql<string>`count(*)`.as("bookings"), sql<string>`coalesce(sum(b.total_minor) filter (where b.status = 'CONFIRMED'), 0)`.as("revenue")])
          .where("b.created_at", ">=", new Date(this.clock.now().getTime() - opts.days * 86_400_000))
          .groupBy("day")
          .orderBy("day")
          .execute(),
      ]);

      const statusCount = Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)]));
      const tStatus = Object.fromEntries(ticketStatus.map((r) => [r.status, Number(r.n)]));
      const oldest = pending.oldest ? new Date(pending.oldest) : null;
      return {
        bookingsByStatus: statusCount,
        revenueMinor: revenue.map((r) => ({ currency: r.currency, amountMinor: Number(r.sum) })),
        tickets: { valid: tStatus.VALID ?? 0, checkedIn: tStatus.USED ?? 0, revoked: tStatus.REVOKED ?? 0 },
        paymentsWaiting: { count: Number(pending.n), oldestMinutes: oldest ? Math.max(Math.round((this.clock.now().getTime() - oldest.getTime()) / 60_000), 0) : null },
        emailsFailed: Number(failedEmails.n),
        byTicketType: perType.map((r) => ({ ticketTypeId: r.id, name: r.name, eventId: r.event_id, capacity: r.quantity, sold: Number(r.sold), held: Number(r.held), revenueMinor: Number(r.revenue) })),
        salesByDay: perDay.map((r) => ({ day: r.day, bookings: Number(r.bookings), revenueMinor: Number(r.revenue) })),
      };
    });
  }

  private empty() {
    return {
      bookingsByStatus: {}, revenueMinor: [], tickets: { valid: 0, checkedIn: 0, revoked: 0 }, paymentsWaiting: { count: 0, oldestMinutes: null }, emailsFailed: 0,
      byTicketType: [], salesByDay: [],
    };
  }
}
