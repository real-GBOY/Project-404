import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUrlParams } from "@/hooks/use-url-params";
import { httpClient } from "@/lib/api/http-client";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatCard } from "@/components/ui/stat-card";
import { Pill, type PillTone } from "@/components/ui/badge";
import { MatterChip } from "@/components/ui/matter-chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Cell,
  ColumnHeader,
  ListCard,
  ListRow,
  ListToolbar,
  ViewToggle,
} from "@/components/tables/list-card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { EmptyState } from "@/components/feedback/empty-state";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { useMatterFormOptions } from "@/features/matters/hooks/use-matters";
import { useTaskList, useTaskMutations } from "../hooks/use-tasks";
import type { TaskListParams, TaskPriority } from "../api/tasks.api";

const RANGES = ["today", "week", "overdue", "all"] as const;

const taskSchema = z.object({
  title: z.string().trim().min(2, "tasks.errors.title_required"),
  matterId: z.string().optional(),
  priority: z.enum(["low", "normal", "high"]),
  dueAt: z.string().optional(),
});
type TaskValues = z.infer<typeof taskSchema>;

function TaskDialog({
  open,
  onOpenChange,
  matterId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  matterId?: string;
}) {
  const { t } = useTranslation("tasks");
  const options = useMatterFormOptions();
  const { create } = useTaskMutations(matterId);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: "normal", matterId: matterId ?? "" },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (isSubmitting ? undefined : onOpenChange(o))}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("dialog.title")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(async (v) => {
            await create.mutateAsync({
              title: v.title,
              matterId: v.matterId || null,
              priority: v.priority,
              dueAt: v.dueAt || null,
            });
            reset();
            onOpenChange(false);
          })}
          noValidate
        >
          <DialogBody className="flex flex-col gap-4 py-3">
            <FormField label={t("fields.title")} required error={errors.title && t(errors.title.message ?? "")}>
              {/* eslint-disable-next-line jsx-a11y/no-autofocus -- first field of a focused create dialog */}
              <Input autoFocus {...register("title")} />
            </FormField>
            {!matterId && (
              <FormField label={t("fields.matter")}>
                <Combobox
                  options={(options.data?.matters ?? []).map((m) => ({ value: m.id, label: m.name }))}
                  value={watch("matterId") || null}
                  onValueChange={(val) => setValue("matterId", val ?? "")}
                  placeholder={t("fields.matter_none")}
                />
              </FormField>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("fields.priority")}>
                <Select value={watch("priority")} onValueChange={(v) => setValue("priority", v as TaskPriority)}>
                  <SelectTrigger aria-label={t("fields.priority")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t("priority.low")}</SelectItem>
                    <SelectItem value="normal">{t("priority.normal")}</SelectItem>
                    <SelectItem value="high">{t("priority.high")}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t("fields.due")}>
                <DatePicker value={watch("dueAt") ?? null} onValueChange={(v) => setValue("dueAt", v ?? "")} />
              </FormField>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t("common:actions.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const PRIORITY_TONE: Record<TaskPriority, PillTone> = { high: "red", normal: "amber", low: "gray" };
const STATUS_TONE: Record<string, PillTone> = {
  todo: "gray",
  in_progress: "blue",
  done: "green",
};

export function TasksListPage({
  embedded: _embedded = false,
  matterId,
}: {
  embedded?: boolean;
  matterId?: string;
}) {
  const { t } = useTranslation("tasks");
  const { can } = usePermissions();
  const navigate = useNavigate();
  const params = useUrlParams<"range" | "mine" | "view">({
    range: matterId ? "all" : "today",
    view: "table",
  });
  const range = (RANGES as readonly string[]).includes(params.get("range") ?? "")
    ? (params.get("range") as (typeof RANGES)[number])
    : "today";
  const mine = params.get("mine") !== "everyone";
  const view = (params.get("view") ?? "table") as "table" | "grid";

  const listParams: TaskListParams = matterId ? { matterId, status: "all" } : { range, mine };
  const query = useTaskList(listParams);
  const { complete } = useTaskMutations(matterId);
  const [creating, setCreating] = useState(false);
  const canManage = can("update:task");

  const summary = useQuery({
    queryKey: ["tasks", "summary"],
    queryFn: ({ signal }) =>
      httpClient<{ open: number; dueThisWeek: number; overdue: number; completed30d: number }>(
        "/tasks/summary",
        { signal },
      ),
    enabled: !matterId,
  });

  const columns = [
    { key: "task", label: t("columns.task"), flex: 1 },
    { key: "matter", label: t("columns.matter"), width: 110 },
    { key: "assignee", label: t("columns.assignee"), width: 140 },
    { key: "due", label: t("columns.due"), width: 110 },
    { key: "priority", label: t("columns.priority"), width: 90 },
    { key: "status", label: t("columns.status"), width: 110 },
  ] as const;

  const s = summary.data;
  const addBtn = can("create:task") && (
    <Button size="sm" icon="add" onClick={() => setCreating(true)}>
      {t("actions.add")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      {!matterId && (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <StatCard label={t("kpi.open")} value={s?.open ?? "—"} />
          <StatCard label={t("kpi.due_week")} value={s?.dueThisWeek ?? "—"} valueTone="brand" />
          <StatCard label={t("kpi.overdue")} value={s?.overdue ?? "—"} valueTone="danger" />
          <StatCard label={t("kpi.completed")} value={s?.completed30d ?? "—"} valueTone="success" />
        </div>
      )}

      <ListCard>
        <ListToolbar>
          {!matterId && (
            <SegmentedControl
              aria-label={t("range.label")}
              size="sm"
              value={range}
              onValueChange={(v) => params.set({ range: v })}
              options={RANGES.map((r) => ({ value: r, label: t(`range.${r}`) }))}
            />
          )}
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {!matterId && (
              <SegmentedControl
                aria-label={t("scope.label")}
                size="sm"
                value={mine ? "mine" : "everyone"}
                onValueChange={(v) => params.set({ mine: v === "mine" ? undefined : "everyone" })}
                options={[
                  { value: "mine", label: t("scope.mine") },
                  { value: "everyone", label: t("scope.everyone") },
                ]}
              />
            )}
            <ViewToggle
              value={view}
              onChange={(v) => params.set({ view: v })}
              labels={{ table: t("common:table.view_table"), grid: t("common:table.view_grid") }}
            />
            {addBtn}
          </div>
        </ListToolbar>

        <QueryBoundary
          query={query}
          loading={<RowsSkeleton rows={6} />}
          isEmpty={(d) => d.items.length === 0}
          empty={
            <EmptyState
              icon="task_alt"
              title={t("empty.title")}
              description={t("empty.body")}
              action={addBtn || undefined}
            />
          }
        >
          {(data) => {
            if (view === "grid") {
              return (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-3.5 px-[18px] py-4">
                  {data.items.map((k) => (
                    <div
                      key={k.id}
                      className="rounded-card border border-border bg-surface p-4 hover:border-border-accent"
                    >
                      <div className="flex items-start gap-[11px]">
                        <Checkbox
                          className="mt-px"
                          checked={k.status === "done"}
                          disabled={!canManage}
                          onCheckedChange={() => complete.mutate(k.id)}
                          aria-label={t("actions.toggle_complete")}
                        />
                        <div
                          className={`min-w-0 flex-1 text-[13px] font-bold leading-[1.4] ${
                            k.status === "done" ? "text-muted line-through" : "text-foreground"
                          }`}
                        >
                          {k.title}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {k.matterReference && <MatterChip>{k.matterReference}</MatterChip>}
                        <Pill tone={PRIORITY_TONE[k.priority]}>{t(`priority.${k.priority}`)}</Pill>
                        <Pill tone={STATUS_TONE[k.status]}>{t(`status.${k.status}`)}</Pill>
                      </div>
                      <div className="mt-3 flex items-center gap-2.5 border-t border-divider pt-3">
                        <span className="text-[11.5px] font-semibold text-secondary">
                          {k.assignee ?? "—"}
                        </span>
                        {k.dueAt && (
                          <span className="ms-auto text-[11.5px] font-bold">
                            {t("due_prefix", {
                              date: formatDate(k.dueAt, { day: "numeric", month: "short" }),
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            return (
              <>
                <ColumnHeader columns={[...columns]} />
                {data.items.map((k) => (
                  <ListRow key={k.id}>
                    <Cell col={columns[0]} className="flex items-center gap-[11px]">
                      <Checkbox
                        checked={k.status === "done"}
                        disabled={!canManage}
                        onCheckedChange={() => complete.mutate(k.id)}
                        aria-label={t("actions.toggle_complete")}
                      />
                      <button
                        type="button"
                        onClick={() => k.matterId && navigate(`/matters/${k.matterId}?tab=tasks`)}
                        className={`truncate text-start text-[13px] font-bold ${
                          k.status === "done" ? "text-muted line-through" : "text-foreground"
                        }`}
                      >
                        {k.title}
                      </button>
                    </Cell>
                    <Cell col={columns[1]}>
                      {k.matterReference ? <MatterChip>{k.matterReference}</MatterChip> : "—"}
                    </Cell>
                    <Cell col={columns[2]} className="truncate">
                      {k.assignee ?? "—"}
                    </Cell>
                    <Cell
                      col={columns[3]}
                      className={k.overdue ? "font-bold text-danger" : ""}
                    >
                      {k.dueAt ? formatDate(k.dueAt, { day: "numeric", month: "short" }) : "—"}
                    </Cell>
                    <Cell col={columns[4]}>
                      <Pill tone={PRIORITY_TONE[k.priority]}>{t(`priority.${k.priority}`)}</Pill>
                    </Cell>
                    <Cell col={columns[5]}>
                      <Pill tone={STATUS_TONE[k.status]}>{t(`status.${k.status}`)}</Pill>
                    </Cell>
                  </ListRow>
                ))}
              </>
            );
          }}
        </QueryBoundary>
      </ListCard>

      <TaskDialog open={creating} onOpenChange={setCreating} matterId={matterId} />
    </div>
  );
}
