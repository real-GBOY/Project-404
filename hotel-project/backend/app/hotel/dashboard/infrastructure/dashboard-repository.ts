import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";
import type { IsoDate } from "@hotel/hotel/shared/dates.js";
import { moneyNumber } from "@hotel/hotel/shared/money.js";

/**
 * Aggregates for the dashboard, computed in SQL (one round-trip per figure family, bounded to a
 * small date window) — never by loading rows into memory. Every number is derived from the
 * ledgers: allocations for occupancy, folio charges for revenue, charges − payments for balances.
 */
@Injectable()
export class DashboardRepository {
  private org() {
    return requireOrganizationId();
  }

  /** Arrivals/departures for a day: how many in total and how many still to process. */
  async movements(day: IsoDate) {
    const org = this.org();
    const rows = await sql<{
      arrivals: number;
      arrivals_pending: number;
      departures: number;
      departures_pending: number;
    }>`
      SELECT
        count(*) FILTER (WHERE arrival = ${day}::date AND status IN ('pending', 'confirmed', 'checked_in', 'checked_out'))::int AS arrivals,
        count(*) FILTER (WHERE arrival = ${day}::date AND status IN ('pending', 'confirmed'))::int AS arrivals_pending,
        count(*) FILTER (WHERE departure = ${day}::date AND status IN ('checked_in', 'checked_out'))::int AS departures,
        count(*) FILTER (WHERE departure <= ${day}::date AND status = 'checked_in')::int AS departures_pending
      FROM hotel_reservations
      WHERE organization_id = ${org}
    `.execute(hotelDb());
    return rows.rows[0]!;
  }

  /** Σ (charges + VAT − completed payments) over guests in house. */
  async recentReservations(limit: number) {
    const org = this.org();
    const rows = await sql<{
      id: string;
      code: string;
      status: string;
      guest_name: string;
      room_number: string | null;
      arrival: string;
      departure: string;
      total: string;
    }>`
      SELECT r.id, r.code, r.status, g.full_name AS guest_name, rm.number AS room_number,
             r.arrival::text AS arrival, r.departure::text AS departure, r.total::text AS total
        FROM hotel_reservations r
        JOIN hotel_guests g ON g.organization_id = r.organization_id AND g.id = r.guest_id
        LEFT JOIN hotel_room_allocations a ON a.organization_id = r.organization_id AND a.reservation_id = r.id AND a.kind = 'reservation'
        LEFT JOIN hotel_rooms rm ON rm.organization_id = a.organization_id AND rm.id = a.room_id
       WHERE r.organization_id = ${org}
       ORDER BY r.created_at DESC, r.code DESC
       LIMIT ${limit}
    `.execute(hotelDb());
    return rows.rows.map((r) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      guestName: r.guest_name,
      roomNumber: r.room_number,
      arrival: r.arrival,
      departure: r.departure,
      total: moneyNumber(r.total),
    }));
  }

  /** Operational alerts worth a human's attention today. */
  async alerts(day: IsoDate) {
    const org = this.org();
    const [tickets, notReady, vip, balances] = await Promise.all([
      sql<{ id: string; number: string; title: string; room_number: string; priority: string }>`
        SELECT m.id, m.number, m.title, r.number AS room_number, m.priority
          FROM hotel_maintenance_tickets m
          JOIN hotel_rooms r ON r.organization_id = m.organization_id AND r.id = m.room_id
         WHERE m.organization_id = ${org} AND m.status <> 'verified' AND m.priority IN ('urgent', 'high')
         ORDER BY CASE m.priority WHEN 'urgent' THEN 0 ELSE 1 END, m.created_at
         LIMIT 5
      `.execute(hotelDb()),
      sql<{ room_number: string; housekeeping_status: string; guest_name: string }>`
        SELECT rm.number AS room_number, rm.housekeeping_status, g.full_name AS guest_name
          FROM hotel_reservations r
          JOIN hotel_guests g ON g.organization_id = r.organization_id AND g.id = r.guest_id
          JOIN hotel_room_allocations a ON a.organization_id = r.organization_id AND a.reservation_id = r.id AND a.active
          JOIN hotel_rooms rm ON rm.organization_id = a.organization_id AND rm.id = a.room_id
         WHERE r.organization_id = ${org} AND r.status = 'confirmed' AND r.arrival = ${day}::date
           AND rm.housekeeping_status NOT IN ('clean', 'inspected')
         ORDER BY rm.number
      `.execute(hotelDb()),
      sql<{ id: string; guest_name: string; room_number: string | null }>`
        SELECT r.id, g.full_name AS guest_name, rm.number AS room_number
          FROM hotel_reservations r
          JOIN hotel_guests g ON g.organization_id = r.organization_id AND g.id = r.guest_id AND g.vip
          LEFT JOIN hotel_room_allocations a ON a.organization_id = r.organization_id AND a.reservation_id = r.id AND a.active
          LEFT JOIN hotel_rooms rm ON rm.organization_id = a.organization_id AND rm.id = a.room_id
         WHERE r.organization_id = ${org} AND r.status IN ('pending', 'confirmed') AND r.arrival = ${day}::date
      `.execute(hotelDb()),
      sql<{ id: string; code: string; guest_name: string; balance: string }>`
        SELECT r.id, r.code, g.full_name AS guest_name,
               (COALESCE((SELECT sum(c.amount + c.tax_amount) FROM hotel_folio_charges c
                           WHERE c.organization_id = r.organization_id AND c.reservation_id = r.id AND c.voided_at IS NULL), 0)
              - COALESCE((SELECT sum(p.amount) FROM hotel_payments p
                           WHERE p.organization_id = r.organization_id AND p.reservation_id = r.id AND p.status = 'completed'), 0)
              + COALESCE((SELECT sum(f.amount) FROM hotel_refunds f
                           WHERE f.organization_id = r.organization_id AND f.reservation_id = r.id AND f.status = 'completed'), 0))::text AS balance
          FROM hotel_reservations r
          JOIN hotel_guests g ON g.organization_id = r.organization_id AND g.id = r.guest_id
         WHERE r.organization_id = ${org} AND r.status = 'checked_in' AND r.departure <= ${day}::date
      `.execute(hotelDb()),
    ]);
    return {
      tickets: tickets.rows,
      notReady: notReady.rows,
      vip: vip.rows,
      balances: balances.rows
        .map((b) => ({ ...b, balance: moneyNumber(b.balance) }))
        .filter((b) => b.balance > 0),
    };
  }
}
