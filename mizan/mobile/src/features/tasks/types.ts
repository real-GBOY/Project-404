export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "normal" | "high";

/** Ported from mizan/web/src/features/tasks/api/tasks.api.ts. */
export interface TaskRow {
  id: string;
  title: string;
  matterId: string | null;
  matterTitle: string | null;
  matterReference: string | null;
  assigneeId: string | null;
  assignee: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  overdue: boolean;
  createdAt: string;
  completedAt: string | null;
}

export interface TaskListParams {
  mine?: boolean;
  matterId?: string;
  status?: TaskStatus | "all";
  range?: "today" | "week" | "overdue" | "all";
}
