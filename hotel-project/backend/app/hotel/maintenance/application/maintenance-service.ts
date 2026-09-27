import { formatEgp } from "@hotel/hotel/shared/money.js";
import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { currentExecutor, readInTenant } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { AUDIT_LOGGER, CLOCK, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IEventBus } from "@core/contracts/index.js";
import { defineEvent } from "@core/contracts/index.js";
import { UserDirectory } from "@core/identity/application/user-directory.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { permissionMatches } from "@core/rbac/domain/permission.js";
import type { IsoDate } from "@hotel/hotel/shared/dates.js";
import { isExclusionViolation } from "@hotel/hotel/shared/pg-errors.js";
import { withSavepoint } from "@hotel/hotel/shared/savepoint.js";
import { SettingsService } from "@hotel/hotel/settings/application/settings-service.js";
import { RoomsRepository } from "@hotel/hotel/rooms/infrastructure/rooms-repository.js";
import { ReservationsRepository } from "@hotel/hotel/reservations/infrastructure/reservations-repository.js";
import {
  ticketCommands,
  ticketTransition,
  type RoomImpact,
  type TicketCommand,
  type TicketPriority,
} from "../domain/ticket-state.js";
import {
  MaintenanceRepository,
  type EventKind,
  type TicketFilter,
  type TicketRecord,
} from "../infrastructure/maintenance-repository.js";

/**
 * Maintenance tickets. A ticket with room impact claims the room's nights in the allocation
 * ledger (so the room can't be sold over the repair, and can't be blocked over a booked stay) and
 * sets the room's service status. The block ends — and the room returns to service — only when a
 * supervisor VERIFIES the fix. Technicians work their own tickets; supervisors
 * (`manage:maintenance`) assign, block, verify and reopen — checked against live permissions.
 */
@Injectable()
export class MaintenanceService {
  constructor(
    private readonly repo: MaintenanceRepository,
    private readonly rooms: RoomsRepository,
    private readonly ledger: ReservationsRepository,
    private readonly settings: SettingsService,
    private readonly directory: UserDirectory,
    private readonly rbac: RbacService,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async list(filter: TicketFilter) {
    return readInTenant(async () => {
      const tickets = await this.repo.list(filter);
      const names = await this.directory.userNames(tickets.map((t) => t.assigneeId));
      return tickets.map((t) => this.view(t, names));
    });
  }

  async get(id: string) {
    return readInTenant(async () => {
      const t = await this.repo.findById(id);
      if (!t) throw NotFound("maintenance.not_found", "Ticket not found.");
      const events = await this.repo.events(id);
      const names = await this.directory.userNames([
        t.assigneeId,
        t.reportedBy,
        ...events.map((e) => e.actor_id),
      ]);
      return {
        ...this.view(t, names),
        reportedByName: t.reportedBy ? (names.get(t.reportedBy) ?? null) : null,
        timeline: events.map((e) => ({
          kind: e.kind,
          body: e.body,
          actorName: e.actor_id ? (names.get(e.actor_id) ?? "—") : "System",
          at: e.created_at,
        })),
      };
    });
  }

  /** Anyone with `create:maintenance` reports; taking the room out of sale needs a supervisor. */
  report(
    input: {
      roomId: string;
      title: string;
      description: string | null;
      priority: TicketPriority;
      roomImpact: RoomImpact;
      expectedBack: IsoDate | null;
    },
    actorId: string,
  ) {
    return this.uow.transaction(async () => {
      const room = await this.rooms.findById(input.roomId);
      if (!room || room.archivedAt)
        throw ValidationError("maintenance.unknown_room", "Room not found.");
      const today = await this.settings.today();
      if (input.roomImpact !== "none") {
        await this.requireSupervisor(actorId, "Only a supervisor can take a room out of sale.");
        if (!input.expectedBack || input.expectedBack <= today) {
          throw ValidationError(
            "maintenance.expected_back_required",
            "Say when the room is expected back — a date after today.",
          );
        }
      }
      const id = await this.repo.insert({
        number: await this.repo.nextNumber(),
        roomId: room.id,
        title: input.title,
        description: input.description,
        priority: input.priority,
        roomImpact: input.roomImpact,
        expectedBack: input.roomImpact === "none" ? null : input.expectedBack,
        reportedBy: actorId,
      });
      if (input.roomImpact !== "none") {
        await this.claimBlock(room.id, room.number, id, today, input.expectedBack!);
        await this.rooms.setServiceStatus(room.id, input.roomImpact);
      }
      await this.repo.addEvent(id, "reported", input.description, actorId);
      const t = (await this.repo.findById(id))!;
      await this.audit.record({
        actorId,
        action: "hotel.maintenance.reported",
        resourceType: "hotel_maintenance_ticket",
        resourceId: id,
        after: {
          number: t.number,
          roomId: room.id,
          priority: t.priority,
          roomImpact: t.roomImpact,
        },
      });
      await this.events.publish(
        defineEvent("maintenance.ticket_reported", 1, {
          ticketId: id,
          number: t.number,
          roomId: room.id,
          priority: t.priority,
          roomImpact: t.roomImpact,
        }),
      );
      return this.view(t, new Map());
    });
  }

  assign(id: string, assigneeId: string, actorId: string) {
    return this.uow.transaction(async () => {
      await this.requireSupervisor(actorId, "Only a supervisor can assign tickets.");
      await this.requireMember(assigneeId);
      return this.apply(id, "assign", actorId, { assigneeId });
    });
  }

  start(id: string, actorId: string) {
    return this.uow.transaction(() => this.apply(id, "start", actorId));
  }

  resolve(id: string, notes: string | null, actorId: string) {
    return this.uow.transaction(() => this.apply(id, "resolve", actorId, { notes }));
  }

  reopen(id: string, reason: string, actorId: string) {
    return this.uow.transaction(async () => {
      await this.requireSupervisor(actorId, "Only a supervisor can reopen a ticket.");
      return this.apply(id, "reopen", actorId, { notes: reason });
    });
  }

  verify(id: string, actorId: string) {
    return this.uow.transaction(async () => {
      await this.requireSupervisor(actorId, "Only a supervisor can verify a repair.");
      return this.apply(id, "verify", actorId);
    });
  }

  addNote(id: string, body: string, actorId: string) {
    return this.uow.transaction(async () => {
      const t = await this.requireOpen(id);
      await this.requireWorkerOrSupervisor(t, actorId);
      await this.repo.addEvent(id, "note", body, actorId);
      return { ok: true };
    });
  }

  setCost(id: string, cost: number, actorId: string) {
    return this.uow.transaction(async () => {
      const t = await this.requireOpen(id);
      await this.requireWorkerOrSupervisor(t, actorId);
      await this.repo.update(id, { cost });
      await this.repo.addEvent(id, "cost", formatEgp(cost), actorId);
      await this.audit.record({
        actorId,
        action: "hotel.maintenance.cost_updated",
        resourceType: "hotel_maintenance_ticket",
        resourceId: id,
        before: { cost: t.cost },
        after: { cost },
      });
      return { ok: true };
    });
  }

  /** Push the block's end date out (the repair needs longer). The ledger decides if it's free. */
  extendBlock(id: string, expectedBack: IsoDate, actorId: string) {
    return this.uow.transaction(async () => {
      await this.requireSupervisor(actorId, "Only a supervisor can change a room block.");
      const t = await this.requireOpen(id);
      if (t.roomImpact === "none" || !t.expectedBack) {
        throw Conflict("maintenance.no_block", "This ticket doesn't take the room out of sale.");
      }
      if (expectedBack <= t.expectedBack) {
        throw ValidationError("maintenance.not_later", "Choose a date after the current one.");
      }
      try {
        await withSavepoint(() => this.ledger.extendBlock(id, expectedBack));
      } catch (err) {
        if (!isExclusionViolation(err)) throw err;
        const codes = await this.ledger.overlappingStays(t.roomId, t.expectedBack, expectedBack);
        throw Conflict(
          "maintenance.room_booked",
          `Room ${t.roomNumber} is booked in that period (${codes.join(", ")}). Move those stays first.`,
          { reservations: codes },
        );
      }
      await this.repo.update(id, { expectedBack });
      await this.repo.addEvent(id, "block_extended", expectedBack, actorId);
      await this.audit.record({
        actorId,
        action: "hotel.maintenance.block_extended",
        resourceType: "hotel_maintenance_ticket",
        resourceId: id,
        before: { expectedBack: t.expectedBack },
        after: { expectedBack },
      });
      return { ok: true };
    });
  }

  // ─── internals ────────────────────────────────────────────────────────────

  private async apply(
    id: string,
    command: TicketCommand,
    actorId: string,
    extra: { assigneeId?: string; notes?: string | null } = {},
  ) {
    const t = await this.repo.findById(id, true);
    if (!t) throw NotFound("maintenance.not_found", "Ticket not found.");
    const next = ticketTransition(t.status, command);
    if (command === "start" || command === "resolve")
      await this.requireWorkerOrSupervisor(t, actorId);

    const now = this.clock.now();
    await this.repo.update(id, {
      status: next,
      ...(command === "assign" && { assigneeId: extra.assigneeId! }),
      ...(command === "start" && !t.assigneeId && { assigneeId: actorId }),
      ...(command === "resolve" && { resolvedAt: now, resolutionNotes: extra.notes ?? null }),
      ...(command === "reopen" && { resolvedAt: null }),
      ...(command === "verify" && { verifiedAt: now }),
    });

    if (command === "verify" && t.roomImpact !== "none") {
      const today = await this.settings.today();
      await this.ledger.releaseBlock(id, today);
      // Another open ticket may still be holding the room; only then does it stay out of service.
      const still = await this.ledger.blockImpactOn(t.roomId, today);
      await this.rooms.setServiceStatus(t.roomId, still ?? "in_service");
    }

    const eventKind: EventKind =
      command === "assign"
        ? "assigned"
        : command === "start"
          ? "started"
          : command === "resolve"
            ? "resolved"
            : command === "reopen"
              ? "reopened"
              : "verified";
    await this.repo.addEvent(
      id,
      eventKind,
      command === "assign"
        ? await this.directory.userName(extra.assigneeId!)
        : (extra.notes ?? null),
      actorId,
    );
    await this.audit.record({
      actorId,
      action: `hotel.maintenance.${eventKind}`,
      resourceType: "hotel_maintenance_ticket",
      resourceId: id,
      before: { status: t.status },
      after: { status: next, ...(extra.assigneeId && { assigneeId: extra.assigneeId }) },
    });
    if (next === "resolved" || next === "verified") {
      await this.events.publish(
        defineEvent(`maintenance.ticket_${next}`, 1, { ticketId: id, roomId: t.roomId }),
      );
    }
    const after = (await this.repo.findById(id))!;
    return this.view(after, await this.directory.userNames([after.assigneeId]));
  }

  private async claimBlock(
    roomId: string,
    roomNumber: string,
    ticketId: string,
    from: IsoDate,
    to: IsoDate,
  ): Promise<void> {
    try {
      await withSavepoint(() => this.ledger.insertBlock(roomId, ticketId, from, to));
    } catch (err) {
      if (!isExclusionViolation(err)) throw err;
      const codes = await this.ledger.overlappingStays(roomId, from, to);
      throw Conflict(
        "maintenance.room_booked",
        `Room ${roomNumber} has stays in that period (${codes.join(", ")}). Move them to another room first, or report without taking the room out of sale.`,
        { reservations: codes },
      );
    }
  }

  private async requireOpen(id: string): Promise<TicketRecord> {
    const t = await this.repo.findById(id, true);
    if (!t) throw NotFound("maintenance.not_found", "Ticket not found.");
    if (t.status === "verified") throw Conflict("maintenance.closed", "This ticket is closed.");
    return t;
  }

  private async isSupervisor(userId: string): Promise<boolean> {
    const held = await this.rbac.permissionsForUser(userId);
    return held.some((k) => permissionMatches(k, "manage", "maintenance"));
  }

  private async requireSupervisor(userId: string, message: string): Promise<void> {
    if (!(await this.isSupervisor(userId))) throw Forbidden("maintenance.supervisor_only", message);
  }

  private async requireWorkerOrSupervisor(t: TicketRecord, actorId: string): Promise<void> {
    if (t.assigneeId && t.assigneeId !== actorId && !(await this.isSupervisor(actorId))) {
      throw Forbidden("maintenance.not_your_ticket", "This ticket is assigned to someone else.");
    }
  }

  private async requireMember(userId: string): Promise<void> {
    const row = await currentExecutor()
      .selectFrom("organization_members")
      .select("id")
      .where("organization_id", "=", requireOrganizationId())
      .where("user_id", "=", userId)
      .executeTakeFirst();
    if (!row) throw ValidationError("maintenance.unknown_assignee", "That person is not on staff.");
  }

  private view(t: TicketRecord, names: Map<string, string>) {
    return {
      ...t,
      assigneeName: t.assigneeId ? (names.get(t.assigneeId) ?? null) : null,
      commands: ticketCommands(t.status),
    };
  }
}
