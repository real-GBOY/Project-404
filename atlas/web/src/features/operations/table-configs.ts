import { createElement } from "react";
import type { DataColumn } from "@/components/tables/data-table";
import { TextCell, BadgeCell } from "@/components/tables/data-table";
import type { TableConfigResult, TableQueryParams } from "@/features/shared/table-types";
import { titleCase } from "@/lib/text";
import { useAuth } from "@/features/auth/auth-provider";
import { useTeamDirectory } from "@/api/team";
import { useTasks, useCreateTask, toTaskView, type TaskView, type TaskPriority, type TaskStatus } from "@/api/operations";

/**
 * Table config for: tasks (the only EntityTablePage entity in Operations —
 * workflows/approvals/documents are standalone pages, not this registry).
 *
 * Plain `.ts` (not `.tsx`) — cell renderers are built with `createElement`.
 */

const TASK_PRIORITIES: TaskPriority[] = ["high", "medium", "low"];
const TASK_STATUSES: TaskStatus[] = ["open", "in-progress", "done"];

const taskColumns: DataColumn<TaskView>[] = [
  { key: "priority", label: "Priority", width: 78, render: (r) => createElement(BadgeCell, { status: r.priority }) },
  { key: "task", label: "Task", flex: 2, render: (r) => createElement(TextCell, { value: r.task, sub: r.relatedTo }) },
  { key: "assignee", label: "Assignee", flex: 1, render: (r) => createElement(TextCell, { value: r.assignee, weight: "normal" }) },
  { key: "due", label: "Due", width: 84, render: (r) => createElement(TextCell, { value: r.due, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 108, render: (r) => createElement(BadgeCell, { status: r.status }) },
];

export function useTasksTableConfig(params: TableQueryParams): TableConfigResult<TaskView> {
  const filtered = useTasks({
    assigneeId: params.filters.assigneeId,
    priority: params.filters.priority as TaskPriority | undefined,
    status: params.filters.status as TaskStatus | undefined,
    q: params.q,
  });
  const all = useTasks();
  const team = useTeamDirectory();
  const createTask = useCreateTask();
  const auth = useAuth();

  if (filtered.isLoading || all.isLoading || team.isLoading) return { config: undefined, isLoading: true, error: null };
  if (filtered.error || all.error || team.error) return { config: undefined, isLoading: false, error: filtered.error ?? all.error ?? team.error };

  const toView = (r: NonNullable<typeof filtered.data>[number]) => toTaskView(r, (id) => team.byId.get(id) ?? id);
  const rows = filtered.data!.map(toView);
  const allRows = all.data!.map(toView);
  const openCount = allRows.filter((r) => r.status !== "Done").length;
  const doneCount = allRows.filter((r) => r.status === "Done").length;
  const dueTodayCount = allRows.filter((r) => r.due === "Today").length;

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Tasks",
      subtitle: `${openCount} open tasks · ${dueTodayCount} due today`,
      primaryAction: "New Task",
      columns: taskColumns,
      rows,
      rowKey: (r) => r.id,
      searchPlaceholder: "Search tasks…",
      filters: [
        { label: "Priority", param: "priority", options: TASK_PRIORITIES.map((p) => ({ value: p, label: titleCase(p) })) },
        { label: "Assignee", param: "assigneeId", options: team.members.map((m) => ({ value: m.id, label: m.name })) },
        { label: "Status", param: "status", options: TASK_STATUSES.map((s) => ({ value: s, label: titleCase(s) })) },
      ],
      minWidth: 760,
      kpis: [
        { label: "Open", value: String(openCount) },
        { label: "Due today", value: String(dueTodayCount) },
        { label: "Done", value: String(doneCount) },
        { label: "Total", value: String(allRows.length) },
      ],
      emptyWhy: "Tasks are generated automatically from reservations, contracts, collections and workflow steps that need a human follow-up — none currently match this filter.",
      createForm: {
        title: "New Task",
        submitLabel: "Create Task",
        fields: [
          { name: "title", label: "Task", required: true, placeholder: "What needs to happen?" },
          {
            name: "priority",
            label: "Priority",
            type: "select",
            defaultValue: "medium",
            options: [
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ],
          },
          { name: "dueAt", label: "Due", type: "date", required: true },
          { name: "assigneeId", label: "Assignee", type: "select", required: true, defaultValue: auth.user?.id, options: team.members.map((m) => ({ value: m.id, label: m.name })) },
        ],
        onSubmit: async (values) => {
          await createTask.mutateAsync({
            title: values.title,
            priority: values.priority as TaskPriority,
            assigneeId: values.assigneeId,
            dueAt: new Date(values.dueAt).toISOString(),
          });
        },
      },
    },
  };
}
