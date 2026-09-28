import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { UserDirectory } from "@core/identity/application/user-directory.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";

export interface Subject {
  label: string;
  href: string | null;
}

type Resolver = (ids: string[]) => Promise<Map<string, Subject>>;

/**
 * Resolves audit rows' `(resourceType, resourceId)` to what a person recognises — a booking
 * code, an invoice number, a guest's name — with a link to its screen. One query per type.
 */
@Injectable()
export class ActivityLabels {
  constructor(private readonly directory: UserDirectory) {}

  private org() {
    return requireOrganizationId();
  }

  private rows<T>(query: ReturnType<typeof sql<T>>) {
    return query.execute(hotelDb()).then((r) => r.rows);
  }

  private readonly resolvers: Record<string, Resolver> = {
    hotel_reservation: async (ids) =>
      new Map(
        (
          await this.rows(sql<{ id: string; code: string }>`
            SELECT id, code FROM hotel_reservations
             WHERE organization_id = ${this.org()} AND id IN (${sql.join(ids)})`)
        ).map((r) => [r.id, { label: `#${r.code}`, href: `/reservations/${r.id}` }]),
      ),
    hotel_payment: async (ids) =>
      new Map(
        (
          await this.rows(sql<{ id: string; code: string; reservation_id: string }>`
            SELECT p.id, r.code, p.reservation_id FROM hotel_payments p
              JOIN hotel_reservations r ON r.organization_id = p.organization_id AND r.id = p.reservation_id
             WHERE p.organization_id = ${this.org()} AND p.id IN (${sql.join(ids)})`)
        ).map((r) => [r.id, { label: `#${r.code}`, href: `/reservations/${r.reservation_id}` }]),
      ),
    hotel_refund: async (ids) =>
      new Map(
        (
          await this.rows(sql<{ id: string; code: string; reservation_id: string }>`
            SELECT f.id, r.code, f.reservation_id FROM hotel_refunds f
              JOIN hotel_reservations r ON r.organization_id = f.organization_id AND r.id = f.reservation_id
             WHERE f.organization_id = ${this.org()} AND f.id IN (${sql.join(ids)})`)
        ).map((r) => [r.id, { label: `#${r.code}`, href: `/reservations/${r.reservation_id}` }]),
      ),
    hotel_invoice: async (ids) =>
      new Map(
        (
          await this.rows(sql<{ id: string; number: string }>`
            SELECT id, number FROM hotel_invoices
             WHERE organization_id = ${this.org()} AND id IN (${sql.join(ids)})`)
        ).map((r) => [r.id, { label: r.number, href: `/invoices/${r.id}` }]),
      ),
    hotel_guest: async (ids) =>
      new Map(
        (
          await this.rows(sql<{ id: string; full_name: string }>`
            SELECT id, full_name FROM hotel_guests
             WHERE organization_id = ${this.org()} AND id IN (${sql.join(ids)})`)
        ).map((r) => [r.id, { label: r.full_name, href: `/guests/${r.id}` }]),
      ),
    hotel_room: async (ids) =>
      new Map(
        (
          await this.rows(sql<{ id: string; number: string }>`
            SELECT id, number FROM hotel_rooms
             WHERE organization_id = ${this.org()} AND id IN (${sql.join(ids)})`)
        ).map((r) => [r.id, { label: `Room ${r.number}`, href: "/rooms" }]),
      ),
    hotel_room_type: async (ids) =>
      new Map(
        (
          await this.rows(sql<{ id: string; name: string }>`
            SELECT id, name FROM hotel_room_types
             WHERE organization_id = ${this.org()} AND id IN (${sql.join(ids)})`)
        ).map((r) => [r.id, { label: r.name, href: "/rooms" }]),
      ),
    hotel_housekeeping_task: async (ids) =>
      new Map(
        (
          await this.rows(sql<{ id: string; number: string }>`
            SELECT k.id, r.number FROM hotel_housekeeping_tasks k
              JOIN hotel_rooms r ON r.organization_id = k.organization_id AND r.id = k.room_id
             WHERE k.organization_id = ${this.org()} AND k.id IN (${sql.join(ids)})`)
        ).map((r) => [r.id, { label: `Room ${r.number}`, href: "/housekeeping" }]),
      ),
    hotel_maintenance_ticket: async (ids) =>
      new Map(
        (
          await this.rows(sql<{ id: string; number: string; title: string }>`
            SELECT id, number, title FROM hotel_maintenance_tickets
             WHERE organization_id = ${this.org()} AND id IN (${sql.join(ids)})`)
        ).map((r) => [r.id, { label: `${r.number} · ${r.title}`, href: `/maintenance/${r.id}` }]),
      ),
    user: async (ids) => {
      const names = await this.directory.userNames(ids);
      return new Map(
        ids.map((id) => [id, { label: names.get(id) ?? "a staff member", href: "/staff" }]),
      );
    },
  };

  /** `type:id` → subject, for every row that could be resolved. */
  async resolve(refs: Array<{ type: string; id: string | null }>): Promise<Map<string, Subject>> {
    const byType = new Map<string, Set<string>>();
    for (const r of refs) {
      if (!r.id || !this.resolvers[r.type]) continue;
      byType.set(r.type, (byType.get(r.type) ?? new Set()).add(r.id));
    }
    const out = new Map<string, Subject>();
    for (const [type, ids] of byType) {
      const found = await this.resolvers[type]!([...ids]);
      for (const [id, subject] of found) out.set(`${type}:${id}`, subject);
    }
    return out;
  }
}
