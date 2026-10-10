import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { currentOrganizationId, requireOrganizationId } from "@core/kernel/tenant.js";
import { admitDb } from "@admit/admit/db/executor.js";
import { admitId } from "@admit/admit/shared/ids.js";

export type EventStatus = "draft" | "published" | "cancelled" | "archived";
export type PaymentMethodType = "instapay" | "wallet" | "bank" | "cash_deposit" | "other";

export interface VenueRecord {
  id: string;
  name: string;
  area: string;
  address: string;
  mapUrl: string | null;
  capacity: number;
}
export interface EventRecord {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  venueId: string;
  startsAt: Date;
  endsAt: Date;
  coverUrl: string | null;
  status: EventStatus;
  maxPerBooking: number;
  namedTickets: boolean;
  holdHours: number;
  allowResubmission: boolean;
  currency: string;
  supportEmail: string | null;
  policies: Record<string, string>;
  program: Array<{ time: string; title: string; detail?: string }>;
  publishedAt: Date | null;
}
export interface TicketTypeRecord {
  id: string;
  eventId: string;
  name: string;
  description: string;
  priceMinor: number;
  quantity: number;
  maxPerBooking: number;
  onSale: boolean;
  sortOrder: number;
}
export interface PaymentMethodRecord {
  id: string;
  eventId: string;
  type: PaymentMethodType;
  label: string;
  recipientName: string;
  identifier: string;
  instructions: string[];
  enabled: boolean;
  sortOrder: number;
}

export interface EventInput {
  slug: string;
  title: string;
  category: string;
  description: string;
  venueId: string;
  startsAt: Date;
  endsAt: Date;
  coverUrl?: string | null;
  maxPerBooking: number;
  namedTickets: boolean;
  holdHours: number;
  allowResubmission: boolean;
  supportEmail?: string | null;
  policies: Record<string, string>;
  program: Array<{ time: string; title: string; detail?: string }>;
}

/** Inventory that is spoken for: a booking holds its seats from creation until it is confirmed or its hold ends. */
export const HELD_STATUSES = ["AWAITING_PAYMENT", "IN_REVIEW", "CONFIRMED"] as const;

const eventCols = [
  "id",
  "slug",
  "title",
  "category",
  "description",
  "venue_id",
  "starts_at",
  "ends_at",
  "cover_url",
  "status",
  "max_per_booking",
  "named_tickets",
  "hold_hours",
  "allow_resubmission",
  "currency",
  "support_email",
  "policies",
  "program",
  "published_at",
] as const;

type EventRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  venue_id: string;
  starts_at: Date;
  ends_at: Date;
  cover_url: string | null;
  status: EventStatus;
  max_per_booking: number;
  named_tickets: boolean;
  hold_hours: number;
  allow_resubmission: boolean;
  currency: string;
  support_email: string | null;
  policies: Record<string, string>;
  program: Array<{ time: string; title: string; detail?: string }>;
  published_at: Date | null;
};

const toEvent = (r: EventRow): EventRecord => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  category: r.category,
  description: r.description,
  venueId: r.venue_id,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  coverUrl: r.cover_url,
  status: r.status,
  maxPerBooking: r.max_per_booking,
  namedTickets: r.named_tickets,
  holdHours: r.hold_hours,
  allowResubmission: r.allow_resubmission,
  currency: r.currency,
  supportEmail: r.support_email,
  policies: r.policies,
  program: r.program,
  publishedAt: r.published_at,
});

const toType = (r: {
  id: string;
  event_id: string;
  name: string;
  description: string;
  price_minor: number;
  quantity: number;
  max_per_booking: number;
  on_sale: boolean;
  sort_order: number;
}): TicketTypeRecord => ({
  id: r.id,
  eventId: r.event_id,
  name: r.name,
  description: r.description,
  priceMinor: r.price_minor,
  quantity: r.quantity,
  maxPerBooking: r.max_per_booking,
  onSale: r.on_sale,
  sortOrder: r.sort_order,
});

const toMethod = (r: {
  id: string;
  event_id: string;
  type: PaymentMethodType;
  label: string;
  recipient_name: string;
  identifier: string;
  instructions: string[];
  enabled: boolean;
  sort_order: number;
}): PaymentMethodRecord => ({
  id: r.id,
  eventId: r.event_id,
  type: r.type,
  label: r.label,
  recipientName: r.recipient_name,
  identifier: r.identifier,
  instructions: r.instructions,
  enabled: r.enabled,
  sortOrder: r.sort_order,
});

const toVenue = (r: { id: string; name: string; area: string; address: string; map_url: string | null; capacity: number }): VenueRecord => ({
  id: r.id,
  name: r.name,
  area: r.area,
  address: r.address,
  mapUrl: r.map_url,
  capacity: r.capacity,
});

/** The only code that touches the event-catalogue tables. Every call runs inside a tenant transaction (RLS). */
@Injectable()
export class EventsRepository {
  // ---- venues ---------------------------------------------------------------------------------
  async listVenues(): Promise<VenueRecord[]> {
    return (await admitDb().selectFrom("admit_venues").select(["id", "name", "area", "address", "map_url", "capacity"]).orderBy("name").execute()).map(toVenue);
  }
  async findVenue(id: string): Promise<VenueRecord | undefined> {
    const r = await admitDb()
      .selectFrom("admit_venues")
      .select(["id", "name", "area", "address", "map_url", "capacity"])
      .where("id", "=", id)
      .executeTakeFirst();
    return r ? toVenue(r) : undefined;
  }
  async venuesByIds(ids: string[]): Promise<Map<string, VenueRecord>> {
    if (!ids.length) return new Map();
    const rows = await admitDb().selectFrom("admit_venues").select(["id", "name", "area", "address", "map_url", "capacity"]).where("id", "in", ids).execute();
    return new Map(rows.map((r) => [r.id, toVenue(r)]));
  }
  async insertVenue(v: Omit<VenueRecord, "id">): Promise<string> {
    const id = admitId("vnu");
    await admitDb()
      .insertInto("admit_venues")
      .values({ id, organization_id: requireOrganizationId(), name: v.name, area: v.area, address: v.address, map_url: v.mapUrl, capacity: v.capacity })
      .execute();
    return id;
  }
  async updateVenue(id: string, v: Partial<Omit<VenueRecord, "id">>): Promise<void> {
    await admitDb()
      .updateTable("admit_venues")
      .set({
        ...(v.name !== undefined && { name: v.name }),
        ...(v.area !== undefined && { area: v.area }),
        ...(v.address !== undefined && { address: v.address }),
        ...(v.mapUrl !== undefined && { map_url: v.mapUrl }),
        ...(v.capacity !== undefined && { capacity: v.capacity }),
      })
      .where("id", "=", id)
      .execute();
  }

  async deleteVenue(id: string): Promise<void> {
    await admitDb().deleteFrom("admit_venues").where("id", "=", id).execute();
  }
  async venueEventCount(id: string): Promise<number> {
    const r = await admitDb()
      .selectFrom("admit_events")
      .select(({ fn }) => fn.countAll<string>().as("n"))
      .where("venue_id", "=", id)
      .executeTakeFirstOrThrow();
    return Number(r.n);
  }

  // ---- events ---------------------------------------------------------------------------------
  async findEvent(id: string): Promise<EventRecord | undefined> {
    const r = await admitDb()
      .selectFrom("admit_events")
      .select([...eventCols])
      .where("id", "=", id)
      .executeTakeFirst();
    return r ? toEvent(r as EventRow) : undefined;
  }
  async findEventBySlug(slug: string): Promise<EventRecord | undefined> {
    const r = await admitDb()
      .selectFrom("admit_events")
      .select([...eventCols])
      .where("slug", "=", slug)
      .executeTakeFirst();
    return r ? toEvent(r as EventRow) : undefined;
  }
  /** `ids = null` means every event of the organizer. */
  async listEvents(opts: { ids: string[] | null; status?: EventStatus[] }): Promise<EventRecord[]> {
    if (opts.ids && !opts.ids.length) return [];
    let q = admitDb()
      .selectFrom("admit_events")
      .select([...eventCols]);
    if (opts.ids) q = q.where("id", "in", opts.ids);
    if (opts.status?.length) q = q.where("status", "in", opts.status);
    return (await q.orderBy("starts_at", "desc").execute()).map((r) => toEvent(r as EventRow));
  }
  async insertEvent(i: EventInput, createdBy: string | null): Promise<string> {
    const id = admitId("evt");
    await admitDb()
      .insertInto("admit_events")
      .values({
        id,
        organization_id: requireOrganizationId(),
        slug: i.slug,
        title: i.title,
        category: i.category,
        description: i.description,
        venue_id: i.venueId,
        starts_at: i.startsAt,
        ends_at: i.endsAt,
        cover_url: i.coverUrl ?? null,
        max_per_booking: i.maxPerBooking,
        named_tickets: i.namedTickets,
        hold_hours: i.holdHours,
        allow_resubmission: i.allowResubmission,
        support_email: i.supportEmail ?? null,
        policies: i.policies,
        program: JSON.stringify(i.program) as never,
        created_by: createdBy,
      })
      .execute();
    return id;
  }
  async updateEvent(id: string, i: Partial<EventInput>): Promise<void> {
    await admitDb()
      .updateTable("admit_events")
      .set({
        ...(i.slug !== undefined && { slug: i.slug }),
        ...(i.title !== undefined && { title: i.title }),
        ...(i.category !== undefined && { category: i.category }),
        ...(i.description !== undefined && { description: i.description }),
        ...(i.venueId !== undefined && { venue_id: i.venueId }),
        ...(i.startsAt !== undefined && { starts_at: i.startsAt }),
        ...(i.endsAt !== undefined && { ends_at: i.endsAt }),
        ...(i.coverUrl !== undefined && { cover_url: i.coverUrl }),
        ...(i.maxPerBooking !== undefined && { max_per_booking: i.maxPerBooking }),
        ...(i.namedTickets !== undefined && { named_tickets: i.namedTickets }),
        ...(i.holdHours !== undefined && { hold_hours: i.holdHours }),
        ...(i.allowResubmission !== undefined && { allow_resubmission: i.allowResubmission }),
        ...(i.supportEmail !== undefined && { support_email: i.supportEmail }),
        ...(i.policies !== undefined && { policies: i.policies }),
        ...(i.program !== undefined && { program: JSON.stringify(i.program) as never }),
      })
      .where("id", "=", id)
      .execute();
  }
  async eventHasBookings(id: string): Promise<boolean> {
    const r = await admitDb().selectFrom("admit_bookings").select("id").where("event_id", "=", id).limit(1).executeTakeFirst();
    return !!r;
  }
  async deleteEvent(id: string): Promise<void> {
    await admitDb().deleteFrom("admit_events").where("id", "=", id).execute();
  }
  async setStatus(id: string, status: EventStatus, publishedAt?: Date | null): Promise<void> {
    await admitDb()
      .updateTable("admit_events")
      .set({ status, ...(publishedAt !== undefined && { published_at: publishedAt }) })
      .where("id", "=", id)
      .execute();
  }

  // ---- ticket types ---------------------------------------------------------------------------
  async listTypes(eventIds: string[]): Promise<TicketTypeRecord[]> {
    if (!eventIds.length) return [];
    return (
      await admitDb().selectFrom("admit_ticket_types").selectAll().where("event_id", "in", eventIds).orderBy("sort_order").orderBy("price_minor").execute()
    ).map(toType);
  }
  async findType(id: string): Promise<TicketTypeRecord | undefined> {
    const r = await admitDb().selectFrom("admit_ticket_types").selectAll().where("id", "=", id).executeTakeFirst();
    return r ? toType(r) : undefined;
  }
  /** Locks the type rows (in id order, so two bookings can never deadlock) before inventory is counted. */
  async lockTypes(ids: string[]): Promise<TicketTypeRecord[]> {
    if (!ids.length) return [];
    const rows = await admitDb()
      .selectFrom("admit_ticket_types")
      .selectAll()
      .where("id", "in", [...ids].sort())
      .orderBy("id")
      .forUpdate()
      .execute();
    return rows.map(toType);
  }
  async insertType(eventId: string, t: Omit<TicketTypeRecord, "id" | "eventId">): Promise<string> {
    const id = admitId("tkt");
    await admitDb()
      .insertInto("admit_ticket_types")
      .values({
        id,
        organization_id: requireOrganizationId(),
        event_id: eventId,
        name: t.name,
        description: t.description,
        price_minor: t.priceMinor,
        quantity: t.quantity,
        max_per_booking: t.maxPerBooking,
        on_sale: t.onSale,
        sort_order: t.sortOrder,
      })
      .execute();
    return id;
  }
  async updateType(id: string, t: Partial<Omit<TicketTypeRecord, "id" | "eventId">>): Promise<void> {
    await admitDb()
      .updateTable("admit_ticket_types")
      .set({
        ...(t.name !== undefined && { name: t.name }),
        ...(t.description !== undefined && { description: t.description }),
        ...(t.priceMinor !== undefined && { price_minor: t.priceMinor }),
        ...(t.quantity !== undefined && { quantity: t.quantity }),
        ...(t.maxPerBooking !== undefined && { max_per_booking: t.maxPerBooking }),
        ...(t.onSale !== undefined && { on_sale: t.onSale }),
        ...(t.sortOrder !== undefined && { sort_order: t.sortOrder }),
      })
      .where("id", "=", id)
      .execute();
  }
  async typeHasBookings(id: string): Promise<boolean> {
    const r = await admitDb().selectFrom("admit_booking_lines").select("id").where("ticket_type_id", "=", id).limit(1).executeTakeFirst();
    return !!r;
  }
  async deleteType(id: string): Promise<void> {
    await admitDb().deleteFrom("admit_ticket_types").where("id", "=", id).execute();
  }
  /** Seats spoken for, per ticket type of the given events (live bookings only - never a stored counter). */
  async heldByType(eventIds: string[]): Promise<Map<string, number>> {
    if (!eventIds.length) return new Map();
    const rows = await admitDb()
      .selectFrom("admit_booking_lines as l")
      .innerJoin("admit_bookings as b", (j) => j.onRef("b.id", "=", "l.booking_id").onRef("b.organization_id", "=", "l.organization_id"))
      .select(["l.ticket_type_id as id", sql<string>`sum(l.quantity)`.as("held")])
      .where("b.event_id", "in", eventIds)
      .where("b.status", "in", [...HELD_STATUSES])
      .groupBy("l.ticket_type_id")
      .execute();
    return new Map(rows.map((r) => [r.id, Number(r.held)]));
  }

  // ---- payment methods ------------------------------------------------------------------------
  async listMethods(eventIds: string[], enabledOnly = false): Promise<PaymentMethodRecord[]> {
    if (!eventIds.length) return [];
    let q = admitDb().selectFrom("admit_payment_methods").selectAll().where("event_id", "in", eventIds);
    if (enabledOnly) q = q.where("enabled", "=", true);
    return (await q.orderBy("sort_order").execute()).map(toMethod);
  }
  async findMethod(id: string): Promise<PaymentMethodRecord | undefined> {
    const r = await admitDb().selectFrom("admit_payment_methods").selectAll().where("id", "=", id).executeTakeFirst();
    return r ? toMethod(r) : undefined;
  }
  async insertMethod(eventId: string, m: Omit<PaymentMethodRecord, "id" | "eventId">): Promise<string> {
    const id = admitId("pmt");
    await admitDb()
      .insertInto("admit_payment_methods")
      .values({
        id,
        organization_id: requireOrganizationId(),
        event_id: eventId,
        type: m.type,
        label: m.label,
        recipient_name: m.recipientName,
        identifier: m.identifier,
        instructions: JSON.stringify(m.instructions) as never,
        enabled: m.enabled,
        sort_order: m.sortOrder,
      })
      .execute();
    return id;
  }
  async updateMethod(id: string, m: Partial<Omit<PaymentMethodRecord, "id" | "eventId">>): Promise<void> {
    await admitDb()
      .updateTable("admit_payment_methods")
      .set({
        ...(m.type !== undefined && { type: m.type }),
        ...(m.label !== undefined && { label: m.label }),
        ...(m.recipientName !== undefined && { recipient_name: m.recipientName }),
        ...(m.identifier !== undefined && { identifier: m.identifier }),
        ...(m.instructions !== undefined && { instructions: JSON.stringify(m.instructions) as never }),
        ...(m.enabled !== undefined && { enabled: m.enabled }),
        ...(m.sortOrder !== undefined && { sort_order: m.sortOrder }),
      })
      .where("id", "=", id)
      .execute();
  }
  async deleteMethod(id: string): Promise<void> {
    await admitDb().deleteFrom("admit_payment_methods").where("id", "=", id).execute();
  }
  async methodInUse(id: string): Promise<boolean> {
    const r = await admitDb().selectFrom("admit_payment_submissions").select("id").where("method_id", "=", id).limit(1).executeTakeFirst();
    return !!r;
  }

  // ---- staff scoping --------------------------------------------------------------------------
  async assignedEventIds(userId: string): Promise<string[]> {
    const rows = await admitDb().selectFrom("admit_event_staff").select("event_id").where("user_id", "=", userId).execute();
    return rows.map((r) => r.event_id);
  }

  /** Organizer of the ambient tenant (used by public reads that must not leak across tenants). */
  organizationId(): string | null {
    return currentOrganizationId();
  }
}
