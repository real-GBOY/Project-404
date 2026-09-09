import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { TasksService } from "@app/lawfirm/tasks/tasks-service.js";
import type { AssistantTool, ToolContext } from "./tool.js";

const id = z.string().trim().min(1);
const isoDate = z
  .string()
  .datetime({ offset: true })
  .describe("ISO-8601 timestamp, e.g. 2026-09-10T09:00:00Z");

/**
 * The write side. **Only operations the existing Mizan use cases already
 * support** — no AI-specific mutations. Each tool calls the same service method
 * a Mizan screen calls, so authorization, tenant context, the transaction,
 * activity feed and domain events all happen exactly as they would for a human.
 * The result returned to the model is the *real* outcome of that call.
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
            "Create a task (optionally on a matter, optionally assigned, optionally with a due date). Defaults: assigned to the current user, normal priority.",
          action: "create",
          resource: "task",
          parameters: z.object({
            title: z.string().trim().min(1).max(300),
            matterId: id.nullish(),
            assigneeId: id.nullish(),
            priority: z.enum(["low", "normal", "high"]).optional(),
            dueAt: isoDate.nullish(),
          }),
        },
        (a, ctx) =>
          this.tasks.create(
            {
              title: a.title,
              matterId: a.matterId ?? null,
              assigneeId: a.assigneeId ?? null,
              priority: a.priority,
              dueAt: a.dueAt ?? null,
            },
            ctx.userId,
          ),
      ),
      t(
        {
          name: "update_task",
          description: "Update a task's title, priority, due date or status.",
          action: "update",
          resource: "task",
          parameters: z.object({
            taskId: id,
            title: z.string().trim().min(1).max(300).optional(),
            priority: z.enum(["low", "normal", "high"]).optional(),
            dueAt: isoDate.nullish(),
            status: z.enum(["todo", "in_progress", "done"]).optional(),
          }),
        },
        (a) =>
          this.tasks.update(a.taskId, {
            title: a.title,
            priority: a.priority,
            dueAt: a.dueAt === undefined ? undefined : a.dueAt,
            status: a.status,
          }),
      ),
      t(
        {
          name: "assign_task",
          description: "Assign a task to a team member, or pass null to unassign.",
          action: "assign",
          resource: "task",
          parameters: z.object({ taskId: id, assigneeId: id.nullable() }),
        },
        (a) => this.tasks.assign(a.taskId, a.assigneeId),
      ),
    ];
  }
}
