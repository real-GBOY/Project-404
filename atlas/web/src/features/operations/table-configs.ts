import { createElement } from "react";
import type { DataColumn } from "@/components/tables/data-table";
import { TextCell, BadgeCell } from "@/components/tables/data-table";
import type { TableConfigResult } from "@/features/shared/table-types";
import { useAuth } from "@/features/auth/auth-provider";
import { useTeamDirectory } from "@/api/team";
import { useTasks, useCreateTask, toTaskView, type TaskView, type TaskPriority } from "@/api/operations";

/**
 * Table config for: tasks (the only EntityTablePage entity in Operations —
 * workflows/approvals/documents are standalone pages, not this registry).
 *
 * Plain `.ts` (not `.tsx`) — cell renderers are built with `createElement`.
 */

const taskColumns: DataColumn<TaskView>[] = [
  { key: "priority", label: "Priority", width: 78, render: (r) => createElement(BadgeCell, { status: r.priority }) },
  { key: "task", label: "Task", flex: 2, render: (r) => createElement(TextCell, { value: r.task, sub: r.relatedTo }) },
  { key: "assignee", label: "Assignee", flex: 1, render: (r) => createElement(TextCell, { value: r.assignee, weight: "normal" }) },
  { key: "due", label: "Due", width: 84, render: (r) => createElement(TextCell, { value: r.due, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 108, render: (r) => createElement(BadgeCell, { status: r.status }) },
];

export function useTasksTableConfig(): TableConfigResult<TaskView> {
  const { data, isLoading, error } = useTasks();
  const team = useTeamDirectory();
  const createTask = useCreateTask();
  const auth = useAuth();

  if (isLoading || team.isLoading) return { config: undefined, isLoading: true, error: null };
  if (error || team.error) return { config: undefined, isLoading: false, error: error ?? team.error };

  const rows = (data ?? []).map((r) => toTaskView(r, (id) => team.byId.get(id) ?? id));
  const openCount = rows.filter((r) => r.status !== "Done").length;
  const doneCount = rows.filter((r) => r.status === "Done").length;
  const dueTodayCount = rows.filter((r) => r.due === "Today").length;

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
      searchText: (r) => `${r.task} ${r.relatedTo} ${r.assignee} ${r.status} ${r.priority}`,
      searchPlaceholder: "Filter tasks…",
      filters: ["Priority", "Assignee", "Status"],
      minWidth: 760,
      kpis: [
        { label: "Open", value: String(openCount) },
        { label: "Due today", value: String(dueTodayCount) },
        { label: "Done", value: String(doneCount) },
        { label: "Total", value: String(rows.length) },
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
