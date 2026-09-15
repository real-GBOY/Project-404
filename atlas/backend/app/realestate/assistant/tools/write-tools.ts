import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { TasksService } from "@atlas/realestate/operations/tasks-service.js";
import type { AssistantTool, ToolContext } from "@core/index.js";

const id = z.string().trim().min(1);
const isoDate = z
  .string()
  .datetime({ offset: true })
  .describe("ISO-8601 timestamp, e.g. 2026-09-10T09:00:00Z");

/**
 * The write side. **Only operations the existing Atlas use cases already
 * support** — no AI-specific mutations. Each tool calls the same service method
 * an Atlas screen calls, so authorization, tenant context, the transaction and
 * audit trail all happen exactly as they would for a human. The result
 * returned to the model is the *real* outcome of that call.
 *
 * Ported from `mizan/backend/app/lawfirm/assistant/tools/write-tools.ts`.
 * Scoped to tasks only, same as Mizan v1 — the lowest-risk mutation Atlas
 * already exposes; `TasksService` has no separate "assign" method, so unlike
 * Mizan there is no `assign_task` (inventing one would violate "no AI-invented
 * mutations").
 */
@Injectable()
export class WriteTools {
  constructor(private readonly tasks: TasksService) {}

  tools(): AssistantTool[] {
    const t = <S extends z.ZodTypeAny>(
      def: { name: string; description: string; action: string; resource: string; parameters: S },
      execute: (args: z.infer<S>, ctx: ToolContext) => Promise<unknown>,
    ): AssistantTool<S> => ({
      name: def.name,
      description: def.description,
      permission: { action: def.action, resource: def.resource },
      mutates: true,
      parameters: def.parameters,
      execute,
    });

    return [
      t(
        {
          name: "create_task",
          description:
            "Create a task, optionally attached to a lead/customer/project/unit and assigned to a team member, with a due date. Defaults: assigned to the current user if no assignee is given.",
          action: "create",
          resource: "task",
          parameters: z.object({
            title: z.string().trim().min(1).max(300),
            priority: z.enum(["high", "medium", "low"]).optional(),
            relatedType: z.enum(["lead", "customer", "project", "unit", "reservation", "contract"]).nullish(),
            relatedId: id.nullish(),
            assigneeId: id.optional(),
            dueAt: isoDate,
          }),
        },
        (a, ctx) =>
          this.tasks.create({
            title: a.title,
            priority: a.priority,
            relatedType: a.relatedType ?? null,
            relatedId: a.relatedId ?? null,
            assigneeId: a.assigneeId ?? ctx.userId,
            dueAt: a.dueAt,
          }),
      ),
      t(
        {
          name: "update_task_status",
          description: "Move a task to open, in-progress, or done.",
          action: "update",
          resource: "task",
          parameters: z.object({
            taskId: id,
            status: z.enum(["open", "in-progress", "done"]),
          }),
        },
        (a) => this.tasks.updateStatus(a.taskId, a.status),
      ),
    ];
  }
}
