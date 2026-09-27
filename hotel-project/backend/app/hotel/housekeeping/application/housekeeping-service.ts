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
import { RoomsRepository } from "@hotel/hotel/rooms/infrastructure/rooms-repository.js";
import { SettingsService } from "@hotel/hotel/settings/application/settings-service.js";
import { isUniqueViolation } from "@hotel/hotel/shared/pg-errors.js";
import {
  ROOM_EFFECT,
  taskCommands,
  taskTransition,
  type TaskCommand,
  type TaskStatus,
} from "../domain/task-state.js";
import {
  HousekeepingRepository,
  type TaskFilter,
  type TaskKind,
  type TaskPriority,
  type TaskRecord,
} from "../infrastructure/housekeeping-repository.js";

/**
 * Housekeeping workflow. Every task transition moves the room's housekeeping status in the same
 * transaction (ROOM_EFFECT), so "cleaned" and "available" can never disagree. Housekeepers work
 * their own tasks (`update:housekeeping`); supervisors assign, inspect and reassign
 * (`manage:housekeeping`), checked against live permissions.
 */
@Injectable()
export class HousekeepingService {
  constructor(
    private readonly repo: HousekeepingRepository,
    private readonly rooms: RoomsRepository,
    private readonly settings: SettingsService,
    private readonly directory: UserDirectory,
    private readonly rbac: RbacService,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async list(filter: TaskFilter) {
    return readInTenant(async () => {
      const tasks = await this.repo.list(filter);
      const names = await this.directory.userNames(tasks.map((t) => t.assigneeId));
      return tasks.map((t) => this.view(t, names));
    });
  }

  /**
   * Open a task for a room inside the caller's transaction (check-out does this). If the room
   * already has an open task it is reused — raising its priority if needed — rather than
   * duplicated (a partial unique index enforces one open task per room).
   */
  async openForRoom(input: {
    roomId: string;
    reservationId: string | null;
    kind: TaskKind;
    priority: TaskPriority;
    notes?: string | null;
    actorId: string | null;
  }): Promise<string> {
    const existing = await this.repo.openTaskForRoom(input.roomId);
    if (existing) {
      if (input.priority === "high" && existing.priority !== "high") {
        await this.repo.update(existing.id, { priority: "high" });
      }
      return existing.id;
    }
    const id = await this.repo.create({
      roomId: input.roomId,
      reservationId: input.reservationId,
      kind: input.kind,
      priority: input.priority,
      dueDate: await this.settings.today(),
      notes: input.notes ?? null,
      createdBy: input.actorId,
    });
    await this.audit.record({
      actorId: input.actorId,
      action: "hotel.housekeeping.task_created",
      resourceType: "hotel_housekeeping_task",
      resourceId: id,
      after: { roomId: input.roomId, kind: input.kind, priority: input.priority },
    });
    await this.events.publish(
      defineEvent("housekeeping.task_created", 1, {
        taskId: id,
        roomId: input.roomId,
        kind: input.kind,
        priority: input.priority,
      }),
    );
    return id;
  }

  /** A supervisor opens a task by hand (e.g. a deep clean). */
  async create(
    input: { roomId: string; kind: TaskKind; priority: TaskPriority; notes: string | null },
    actorId: string,
  ) {
    try {
      return await this.uow.transaction(async () => {
        const room = await this.rooms.findById(input.roomId);
        if (!room || room.archivedAt)
          throw ValidationError("housekeeping.unknown_room", "Room not found.");
        if (await this.repo.openTaskForRoom(room.id)) {
          throw Conflict("housekeeping.task_open", `Room ${room.number} already has an open task.`);
        }
        const id = await this.openForRoom({ ...input, reservationId: null, actorId });
        return this.view((await this.repo.findById(id))!, new Map());
      });
    } catch (err) {
      if (isUniqueViolation(err, "hotel_housekeeping_tasks_one_open_uq")) {
        throw Conflict("housekeeping.task_open", "This room already has an open task.");
      }
      throw err;
    }
  }

  assign(taskId: string, assigneeId: string, actorId: string) {
    return this.uow.transaction(async () => {
      await this.requireMember(assigneeId);
      return this.apply(taskId, "assign", actorId, { assigneeId });
    });
  }

  start(taskId: string, actorId: string) {
    return this.uow.transaction(() => this.apply(taskId, "start", actorId));
  }

  complete(taskId: string, notes: string | null, actorId: string) {
    return this.uow.transaction(() => this.apply(taskId, "complete", actorId, { notes }));
  }

  inspect(taskId: string, actorId: string) {
    return this.uow.transaction(() => this.apply(taskId, "inspect", actorId));
  }

  private async apply(
    taskId: string,
    command: TaskCommand,
    actorId: string,
    extra: { assigneeId?: string; notes?: string | null } = {},
  ) {
    const task = await this.repo.findById(taskId, true);
    if (!task) throw NotFound("housekeeping.task_not_found", "Task not found.");
    const next: TaskStatus = taskTransition(task.status, command);
    const supervisor = await this.isSupervisor(actorId);

    if ((command === "assign" || command === "inspect") && !supervisor) {
      throw Forbidden(
        "housekeeping.supervisor_only",
        "Only a supervisor can assign or inspect tasks.",
      );
    }
    if ((command === "start" || command === "complete") && !supervisor) {
      if (task.assigneeId && task.assigneeId !== actorId) {
        throw Forbidden("housekeeping.not_your_task", "This task is assigned to someone else.");
      }
    }

    const now = this.clock.now();
    await this.repo.update(task.id, {
      status: next,
      ...(command === "assign" && { assigneeId: extra.assigneeId! }),
      ...(command === "start" && { startedAt: now, assigneeId: task.assigneeId ?? actorId }),
      ...(command === "complete" && {
        completedAt: now,
        ...(extra.notes !== undefined && extra.notes !== null && { notes: extra.notes }),
      }),
      ...(command === "inspect" && { inspectedAt: now, inspectedBy: actorId }),
    });
    const effect = ROOM_EFFECT[next];
    if (effect) await this.rooms.setHousekeepingStatus(task.roomId, effect);

    await this.audit.record({
      actorId,
      action: `hotel.housekeeping.task_${command === "start" ? "started" : command === "assign" ? "assigned" : command === "complete" ? "completed" : "inspected"}`,
      resourceType: "hotel_housekeeping_task",
      resourceId: task.id,
      before: { status: task.status, assigneeId: task.assigneeId },
      after: {
        status: next,
        roomStatus: effect ?? null,
        ...(extra.assigneeId && { assigneeId: extra.assigneeId }),
      },
    });
    if (next === "completed") {
      await this.events.publish(
        defineEvent("housekeeping.task_completed", 1, { taskId: task.id, roomId: task.roomId }),
      );
    }
    const after = (await this.repo.findById(task.id))!;
    const names = await this.directory.userNames([after.assigneeId]);
    return this.view(after, names);
  }

  private async isSupervisor(userId: string): Promise<boolean> {
    const held = await this.rbac.permissionsForUser(userId);
    return held.some((k) => permissionMatches(k, "manage", "housekeeping"));
  }

  private async requireMember(userId: string): Promise<void> {
    const row = await currentExecutor()
      .selectFrom("organization_members")
      .select("id")
      .where("organization_id", "=", requireOrganizationId())
      .where("user_id", "=", userId)
      .executeTakeFirst();
    if (!row)
      throw ValidationError("housekeeping.unknown_assignee", "That person is not on staff.");
  }

  private view(t: TaskRecord, names: Map<string, string>) {
    return {
      ...t,
      assigneeName: t.assigneeId ? (names.get(t.assigneeId) ?? null) : null,
      commands: taskCommands(t.status),
    };
  }
}
