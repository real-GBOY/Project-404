import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";
import type { IsoDate } from "@hotel/hotel/shared/dates.js";
import { moneyNumber } from "@hotel/hotel/shared/money.js";
import type { PaymentMethod } from "@hotel/hotel/billing/domain/payment-provider.js";
import type { Night } from "../domain/kpis.js";

/**
 * Performance figures, computed in SQL from the ledgers — allocations for room-nights, folio
 * charges for revenue (by service date), payments by business date. Nothing is a stored counter.
 * Shared by the dashboard (7 nights) and Analytics (7 / 30 / 90 nights).
 */
@Injectable()
export class AnalyticsRepository {
  private org() {
    return requireOrganizationId();
  }

  /** Per night in [from, to): room-nights sold, rooms blocked, room and extras revenue. */
  async nights(from: IsoDate, to: IsoDate): Promise<Night[]> {
    const org = this.org();
    const rows = await sql<{
      day: string;
      sold: number;
      blocked: number;
      room_revenue: string;
      extras_revenue: string;
    }>`
      WITH days AS (
        SELECT d::date AS day FROM generate_series(${from}::date, (${to}::date - 1), interval '1 day') d
      ),
      charges AS (
        SELECT service_date,
               sum(amount) FILTER (WHERE kind = 'room') AS room,
               sum(amount) FILTER (WHERE kind <> 'room') AS extras
          FROM hotel_folio_charges
         WHERE organization_id = ${org} AND voided_at IS NULL
           AND service_date >= ${from}::date AND service_date < ${to}::date
         GROUP BY service_date
      )
      SELECT days.day::text AS day,
             (SELECT count(*)::int FROM hotel_room_allocations a
                JOIN hotel_reservations r ON r.organization_id = a.organization_id AND r.id = a.reservation_id
               WHERE a.organization_id = ${org} AND a.kind = 'reservation' AND a.active
                 AND r.status NOT IN ('cancelled', 'no_show') AND a.stay @> days.day) AS sold,
             (SELECT count(*)::int FROM hotel_room_allocations a
               WHERE a.organization_id = ${org} AND a.kind = 'block' AND a.active
                 AND a.stay @> days.day) AS blocked,
             COALESCE(c.room, 0)::text AS room_revenue,
             COALESCE(c.extras, 0)::text AS extras_revenue
        FROM days
        LEFT JOIN charges c ON c.service_date = days.day
       ORDER BY days.day
    `.execute(hotelDb());
    return rows.rows.map((r) => ({
      day: r.day,
      sold: r.sold,
      blocked: r.blocked,
      roomRevenue: moneyNumber(r.room_revenue),
      extrasRevenue: moneyNumber(r.extras_revenue),
    }));
  }

  async roomCount(): Promise<number> {
    const row = await hotelDb()
      .selectFrom("hotel_rooms")
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .where("organization_id", "=", this.org())
      .where("archived_at", "is", null)
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  /**
   * Bookings due to arrive in [from, to): how many, how many were cancelled or didn't show,
   * the average length of the stays that happened, and the mix of channels they came through.
   */
  async arrivals(from: IsoDate, to: IsoDate) {
    const org = this.org();
    const totals = await sql<{
      bookings: number;
      cancelled: number;
      no_shows: number;
      avg_nights: string | null;
    }>`
      SELECT count(*)::int AS bookings,
             count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
             count(*) FILTER (WHERE status = 'no_show')::int AS no_shows,
             avg(departure - arrival) FILTER (WHERE status NOT IN ('cancelled', 'no_show'))::text AS avg_nights
        FROM hotel_reservations
       WHERE organization_id = ${org} AND arrival >= ${from}::date AND arrival < ${to}::date
    `.execute(hotelDb());
    const sources = await sql<{ source: string; bookings: number; revenue: string }>`
      SELECT source, count(*)::int AS bookings, sum(total)::text AS revenue
        FROM hotel_reservations
       WHERE organization_id = ${org} AND arrival >= ${from}::date AND arrival < ${to}::date
         AND status NOT IN ('cancelled', 'no_show')
       GROUP BY source
       ORDER BY count(*) DESC, source
    `.execute(hotelDb());
    const t = totals.rows[0]!;
    return {
      bookings: t.bookings,
      cancelled: t.cancelled,
      noShows: t.no_shows,
      avgNights: t.avg_nights === null ? 0 : Math.round(Number(t.avg_nights) * 10) / 10,
      sources: sources.rows.map((s) => ({
        source: s.source,
        bookings: s.bookings,
        revenue: moneyNumber(s.revenue),
      })),
    };
  }

  /** Completed payments by method, by business date in [from, to). */
  async paymentMethods(from: IsoDate, to: IsoDate) {
    const rows = await sql<{ method: PaymentMethod; amount: string }>`
      SELECT method, sum(amount)::text AS amount
        FROM hotel_payments
       WHERE organization_id = ${this.org()} AND status = 'completed'
         AND business_date >= ${from}::date AND business_date < ${to}::date
       GROUP BY method
       ORDER BY sum(amount) DESC, method
    `.execute(hotelDb());
    return rows.rows.map((r) => ({ method: r.method, amount: moneyNumber(r.amount) }));
  }
}
