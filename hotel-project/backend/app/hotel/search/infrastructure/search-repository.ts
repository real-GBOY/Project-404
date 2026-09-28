import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

const LIMIT = 5;

/** "2026-10-10" → "Oct 10" (a hotel date, no time zone involved). */
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );

/**
 * The ⌘K palette's lookups — one small query per kind of record, each capped at a few hits.
 * `q` is matched case-insensitively as a substring (codes and numbers also by prefix).
 */
@Injectable()
export class SearchRepository {
  private org() {
    return requireOrganizationId();
  }

  private like(q: string) {
    return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  }

  async guests(q: string): Promise<SearchHit[]> {
    const like = this.like(q);
    const rows = await sql<{
      id: string;
      full_name: string;
      phone: string | null;
      email: string | null;
    }>`
      SELECT id, full_name, phone, email FROM hotel_guests
       WHERE organization_id = ${this.org()}
         AND (full_name ILIKE ${like} OR phone ILIKE ${like} OR email ILIKE ${like})
       ORDER BY full_name LIMIT ${LIMIT}
    `.execute(hotelDb());
    return rows.rows.map((g) => ({
      id: g.id,
      title: g.full_name,
      subtitle: g.phone ?? g.email,
      href: `/guests/${g.id}`,
    }));
  }

  async reservations(q: string): Promise<SearchHit[]> {
    const like = this.like(q);
    const rows = await sql<{
      id: string;
      code: string;
      guest_name: string;
      status: string;
      arrival: string;
      departure: string;
    }>`
      SELECT r.id, r.code, g.full_name AS guest_name, r.status,
             r.arrival::text AS arrival, r.departure::text AS departure
        FROM hotel_reservations r
        JOIN hotel_guests g ON g.organization_id = r.organization_id AND g.id = r.guest_id
       WHERE r.organization_id = ${this.org()}
         AND (r.code ILIKE ${like} OR g.full_name ILIKE ${like})
       ORDER BY r.arrival DESC LIMIT ${LIMIT}
    `.execute(hotelDb());
    return rows.rows.map((r) => ({
      id: r.id,
      title: `#${r.code} · ${r.guest_name}`,
      subtitle: `${shortDate(r.arrival)} → ${shortDate(r.departure)} · ${r.status.replace("_", " ")}`,
      href: `/reservations/${r.id}`,
    }));
  }

  async rooms(q: string): Promise<SearchHit[]> {
    const rows = await sql<{ id: string; number: string; type_name: string }>`
      SELECT r.id, r.number, t.name AS type_name
        FROM hotel_rooms r
        JOIN hotel_room_types t ON t.organization_id = r.organization_id AND t.id = r.room_type_id
       WHERE r.organization_id = ${this.org()} AND r.archived_at IS NULL
         AND r.number ILIKE ${`${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`}
       ORDER BY length(r.number), r.number LIMIT ${LIMIT}
    `.execute(hotelDb());
    return rows.rows.map((r) => ({
      id: r.id,
      title: `Room ${r.number}`,
      subtitle: r.type_name,
      href: "/rooms",
    }));
  }

  async invoices(q: string): Promise<SearchHit[]> {
    const like = this.like(q);
    const rows = await sql<{ id: string; number: string; bill_to_name: string; status: string }>`
      SELECT id, number, bill_to_name, status FROM hotel_invoices
       WHERE organization_id = ${this.org()}
         AND (number ILIKE ${like} OR bill_to_name ILIKE ${like})
       ORDER BY issued_at DESC LIMIT ${LIMIT}
    `.execute(hotelDb());
    return rows.rows.map((i) => ({
      id: i.id,
      title: `${i.number} · ${i.bill_to_name}`,
      subtitle: i.status === "void" ? "Void" : null,
      href: `/invoices/${i.id}`,
    }));
  }

  async tickets(q: string): Promise<SearchHit[]> {
    const like = this.like(q);
    const rows = await sql<{
      id: string;
      number: string;
      title: string;
      room_number: string;
      status: string;
    }>`
      SELECT m.id, m.number, m.title, r.number AS room_number, m.status
        FROM hotel_maintenance_tickets m
        JOIN hotel_rooms r ON r.organization_id = m.organization_id AND r.id = m.room_id
       WHERE m.organization_id = ${this.org()}
         AND (m.number ILIKE ${like} OR m.title ILIKE ${like})
       ORDER BY m.created_at DESC LIMIT ${LIMIT}
    `.execute(hotelDb());
    return rows.rows.map((t) => ({
      id: t.id,
      title: `${t.number} · ${t.title}`,
      subtitle: `Room ${t.room_number} · ${t.status.replace("_", " ")}`,
      href: `/maintenance/${t.id}`,
    }));
  }
}
