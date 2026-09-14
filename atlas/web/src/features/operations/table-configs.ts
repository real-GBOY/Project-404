import { createElement } from "react";
import type { DataColumn } from "@/components/tables/data-table";
import { TextCell, BadgeCell } from "@/components/tables/data-table";
import type { TableConfigRegistry } from "@/features/shared/table-types";
import { TASKS, type TaskFixture } from "@/mocks/fixtures/tasks";
import { AUDIT_LOG, type AuditLogEntryFixture } from "@/mocks/fixtures/audit-log";

/**
 * Table configs for: tasks, audit.
 *
 * Plain `.ts` (not `.tsx`) — esbuild's `ts` loader rejects JSX syntax, so
 * cell renderers are built with `createElement` instead of JSX here.
 */

const taskColumns: DataColumn<TaskFixture>[] = [
  { key: "priority", label: "Priority", width: 78, render: (r) => createElement(BadgeCell, { status: r.priority }) },
  { key: "task", label: "Task", flex: 2, render: (r) => createElement(TextCell, { value: r.task, sub: r.relatedTo }) },
  { key: "assignee", label: "Assignee", flex: 1, render: (r) => createElement(TextCell, { value: r.assignee, weight: "normal" }) },
  { key: "due", label: "Due", width: 84, render: (r) => createElement(TextCell, { value: r.due, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 108, render: (r) => createElement(BadgeCell, { status: r.status }) },
];

const auditColumns: DataColumn<AuditLogEntryFixture>[] = [
  { key: "timestamp", label: "Timestamp", width: 138, render: (r) => createElement(TextCell, { value: r.timestamp, mono: true, weight: "normal" }) },
  { key: "user", label: "User", flex: 1, render: (r) => createElement(TextCell, { value: r.user }) },
  { key: "action", label: "Action", width: 108, render: (r) => createElement(BadgeCell, { status: r.action }) },
  { key: "entity", label: "Entity", flex: 1.2, render: (r) => createElement(TextCell, { value: r.entity, weight: "normal" }) },
  { key: "change", label: "Before → After", flex: 1.6, render: (r) => createElement(TextCell, { value: `${r.before} → ${r.after}`, mono: true, weight: "normal" }) },
  { key: "source", label: "Source", width: 84, render: (r) => createElement(BadgeCell, { status: r.source }) },
];

export const operationsTableConfigs: TableConfigRegistry = {
  tasks: {
    title: "Tasks",
    subtitle: "186 open tasks · 42 due today · assigned across sales, finance and operations",
    primaryAction: "New Task",
    columns: taskColumns,
    rows: TASKS,
    rowKey: (r) => `${r.task}|${r.relatedTo}`,
    searchText: (r) => `${r.task} ${r.relatedTo} ${r.assignee} ${r.status} ${r.priority}`,
    searchPlaceholder: "Filter tasks…",
    filters: ["Priority", "Assignee", "Status"],
    minWidth: 760,
    kpis: [
      { label: "Open", value: "186", delta: "+14", deltaSign: "up" },
      { label: "Due today", value: "42" },
      { label: "Overdue", value: "19", delta: "+3", deltaSign: "up" },
      { label: "Completed, 7d", value: "241", delta: "+9%", deltaSign: "up" },
    ],
    emptyWhy:
      "Tasks are generated automatically from reservations, contracts, collections and workflow steps that need a human follow-up — none currently match this filter.",
  },

  audit: {
    title: "Audit Logs",
    subtitle: "Immutable record of every state change · retained 7 years · exportable for compliance",
    columns: auditColumns,
    rows: AUDIT_LOG,
    rowKey: (r) => `${r.timestamp}|${r.entity}`,
    searchText: (r) => `${r.user} ${r.action} ${r.entity} ${r.before} ${r.after} ${r.source}`,
    searchPlaceholder: "Filter audit log…",
    filters: ["User", "Action", "Source"],
    minWidth: 820,
    kpis: [
      { label: "Entries today", value: "1,284" },
      { label: "Users active", value: "38" },
      { label: "Permission changes", value: "2" },
      { label: "Retention", value: "7 years" },
    ],
    emptyWhy:
      "Every reservation, approval, price change and payment writes an entry here the moment it happens — none currently match this filter.",
  },
};
