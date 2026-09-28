import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";
import { hotelId } from "@hotel/hotel/shared/ids.js";
import type { IsoDate } from "@hotel/hotel/shared/dates.js";
import { moneyNumber, moneyString } from "@hotel/hotel/shared/money.js";
import {
  OPEN_TICKET_STATUSES,
  type RoomImpact,
  type TicketPriority,
  type TicketStatus,
} from "../domain/ticket-state.js";

export type EventKind =
  | "reported"
  | "assigned"
  | "started"
  | "note"
  | "cost"
  | "resolved"
  | "reopened"
  | "verified"
  | "block_extended";

export interface TicketRecord {
  id: string;
  number: string;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  title: string;
  description: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeId: string | null;
  cost: number;
  roomImpact: RoomImpact;
  expectedBack: IsoDate | null;
  resolutionNotes: string | null;
  reportedBy: string | null;
  resolvedAt: Date | null;
  verifiedAt: Date | null;
  createdAt: Date;
}

export interface TicketFilter {
  status?: TicketStatus;
  open?: boolean;
  assigneeId?: string;
  roomId?: string;
}

@Injectable()
export class MaintenanceRepository {
  private org() {
    return requireOrganizationId();
  }

  async nextNumber(): Promise<string> {
    const row = await hotelDb()
      .insertInto("hotel_counters")
      .values({ organization_id: this.org(), name: "maintenance", value: "101" })
      .onConflict((oc) =>
        oc
          .columns(["organization_id", "name"])
          .doUpdateSet({ value: sql`hotel_counters.value + 1` }),
      )
      .returning("value")
      .executeTakeFirstOrThrow();
    return `MT-${row.value}`;
  }

  private base() {
    return hotelDb()
      .selectFrom("hotel_maintenance_tickets as m")
      .innerJoin("hotel_rooms as r", (j) =>
        j.onRef("r.id", "=", "m.room_id").onRef("r.organization_id", "=", "m.organization_id"),
      )
      .innerJoin("hotel_room_types as t", (j) =>
        j.onRef("t.id", "=", "r.room_type_id").onRef("t.organization_id", "=", "r.organization_id"),
      )
      .where("m.organization_id", "=", this.org())
      .select([
        "m.id",
        "m.number",
        "m.room_id",
        "r.number as room_number",
        "t.name as room_type_name",
        "m.title",
        "m.description",
        "m.priority",
        "m.status",
        "m.assignee_id",
        "m.cost",
        "m.room_impact",
        sql<string | null>`m.expected_back::text`.as("expected_back"),
        "m.resolution_notes",
        "m.reported_by",
        "m.resolved_at",
        "m.verified_at",
        "m.created_at",
      ]);
  }

  async list(filter: TicketFilter = {}): Promise<TicketRecord[]> {
    let q = this.base();
    if (filter.status) q = q.where("m.status", "=", filter.status);
    if (filter.open) q = q.where("m.status", "in", [...OPEN_TICKET_STATUSES]);
    if (filter.assigneeId) q = q.where("m.assignee_id", "=", filter.assigneeId);
    if (filter.roomId) q = q.where("m.room_id", "=", filter.roomId);
    const rows = await q
      .orderBy(sql`CASE m.status WHEN 'verified' THEN 1 ELSE 0 END`)
      .orderBy(
        sql`CASE m.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`,
      )
      .orderBy("m.created_at", "desc")
      .limit(300)
      .execute();
    return rows.map((r) => this.toRecord(r));
  }

  async findById(id: string, lock = false): Promise<TicketRecord | null> {
    if (lock) {
      await hotelDb()
        .selectFrom("hotel_maintenance_tickets")
        .select("id")
        .where("organization_id", "=", this.org())
        .where("id", "=", id)
        .forUpdate()
        .execute();
    }
    const row = await this.base().where("m.id", "=", id).executeTakeFirst();
    return row ? this.toRecord(row) : null;
  }

  async insert(t: {
    number: string;
    roomId: string;
    title: string;
    description: string | null;
    priority: TicketPriority;
    roomImpact: RoomImpact;
    expectedBack: IsoDate | null;
    reportedBy: string;
  }): Promise<string> {
    const id = hotelId("mtk");
    await hotelDb()
      .insertInto("hotel_maintenance_tickets")
      .values({
        id,
        organization_id: this.org(),
        number: t.number,
        room_id: t.roomId,
        title: t.title,
        description: t.description,
        priority: t.priority,
        room_impact: t.roomImpact,
        expected_back: t.expectedBack,
        reported_by: t.reportedBy,
      })
      .execute();
    return id;
  }

  async update(
    id: string,
    patch: {
      status?: TicketStatus;
      assigneeId?: string;
      cost?: number;
      expectedBack?: IsoDate;
      resolutionNotes?: string | null;
      resolvedAt?: Date | null;
      verifiedAt?: Date;
    },
  ): Promise<void> {
    await hotelDb()
      .updateTable("hotel_maintenance_tickets")
      .set({
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.assigneeId !== undefined && { assignee_id: patch.assigneeId }),
        ...(patch.cost !== undefined && { cost: moneyString(patch.cost) }),
        ...(patch.expectedBack !== undefined && { expected_back: patch.expectedBack }),
        ...(patch.resolutionNotes !== undefined && { resolution_notes: patch.resolutionNotes }),
        ...(patch.resolvedAt !== undefined && { resolved_at: patch.resolvedAt }),
        ...(patch.verifiedAt !== undefined && { verified_at: patch.verifiedAt }),
      })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
  }

  async addEvent(ticketId: string, kind: EventKind, body: string | null, actorId: string | null) {
    await hotelDb()
      .insertInto("hotel_maintenance_events")
      .values({
        id: hotelId("mte"),
        organization_id: this.org(),
        ticket_id: ticketId,
        kind,
        body,
        actor_id: actorId,
      })
      .execute();
  }

  async events(ticketId: string) {
    return hotelDb()
      .selectFrom("hotel_maintenance_events")
      .select(["kind", "body", "actor_id", "created_at"])
      .where("organization_id", "=", this.org())
      .where("ticket_id", "=", ticketId)
      .orderBy("seq")
      .execute();
  }

  private toRecord(r: {
    id: string;
    number: string;
    room_id: string;
    room_number: string;
    room_type_name: string;
    title: string;
    description: string | null;
    priority: TicketPriority;
    status: TicketStatus;
    assignee_id: string | null;
    cost: string;
    room_impact: RoomImpact;
    expected_back: string | null;
    resolution_notes: string | null;
    reported_by: string | null;
    resolved_at: Date | null;
    verified_at: Date | null;
    created_at: Date;
  }): TicketRecord {
    return {
      id: r.id,
      number: r.number,
      roomId: r.room_id,
      roomNumber: r.room_number,
      roomTypeName: r.room_type_name,
      title: r.title,
      description: r.description,
      priority: r.priority,
      status: r.status,
      assigneeId: r.assignee_id,
      cost: moneyNumber(r.cost),
      roomImpact: r.room_impact,
      expectedBack: r.expected_back,
      resolutionNotes: r.resolution_notes,
      reportedBy: r.reported_by,
      resolvedAt: r.resolved_at,
      verifiedAt: r.verified_at,
      createdAt: r.created_at,
    };
  }
}
