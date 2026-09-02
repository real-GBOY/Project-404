import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatRelative } from "@/lib/format";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@/components/ui/segmented-control";
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

export function TasksListPage({
  embedded = false,
  matterId,
}: {
  embedded?: boolean;
  matterId?: string;
}) {
  const { t } = useTranslation("tasks");
  const { can } = usePermissions();
  const params = useUrlParams<"range" | "mine">({ range: matterId ? "all" : "week" });
  const range = (RANGES as readonly string[]).includes(params.get("range") ?? "")
    ? (params.get("range") as (typeof RANGES)[number])
    : "week";
  const mine = params.get("mine") !== "everyone";

  const listParams: TaskListParams = matterId
    ? { matterId, status: "all" }
    : { range, mine };
  const query = useTaskList(listParams);
  const { complete } = useTaskMutations(matterId);
  const [creating, setCreating] = useState(false);
  const canManage = can("update:task");

  const body = (
    <>
      {!matterId && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl
            aria-label={t("range.label")}
            value={range}
            onValueChange={(v) => params.set({ range: v })}
            options={RANGES.map((r) => ({ value: r, label: t(`range.${r}`) }))}
          />
          <div className="flex items-center gap-2">
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
            {!embedded && can("create:task") && (
              <Button icon="add" onClick={() => setCreating(true)}>
                {t("actions.new")}
              </Button>
            )}
          </div>
        </div>
      )}

      <QueryBoundary
        query={query}
        loading={<RowsSkeleton rows={6} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon="task_alt"
            title={t("empty.title")}
            description={t("empty.body")}
            action={
              can("create:task") ? (
                <Button icon="add" onClick={() => setCreating(true)}>
                  {t("actions.new")}
                </Button>
              ) : undefined
            }
          />
        }
      >
        {(data) => (
          <ul className="divide-y divide-divider rounded-lg border border-border bg-surface">
            {data.items.map((k) => (
              <li key={k.id} className="flex items-start gap-3 px-4 py-3">
                <Checkbox
                  className="mt-0.5"
                  checked={k.status === "done"}
                  disabled={!canManage}
                  onCheckedChange={() => complete.mutate(k.id)}
                  aria-label={t("actions.toggle_complete")}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-[12.5px] font-semibold ${
                      k.status === "done" ? "text-muted line-through" : "text-foreground"
                    }`}
                  >
                    {k.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted">
                    {k.matterId && (
                      <Link to={`/matters/${k.matterId}?tab=tasks`} className="text-link hover:underline">
                        {k.matterReference}
                      </Link>
                    )}
                    {k.assignee && <span>{k.assignee}</span>}
                    {k.dueAt && (
                      <span className={k.overdue ? "font-semibold text-danger" : ""}>
                        {formatRelative(k.dueAt)}
                      </span>
                    )}
                  </div>
                </div>
                {k.priority === "high" && k.status !== "done" && (
                  <Badge tone="danger" size="sm">
                    {t("priority.high")}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>

      <TaskDialog open={creating} onOpenChange={setCreating} matterId={matterId} />
    </>
  );

  if (embedded || matterId) return <div className="flex flex-col gap-4">{body}</div>;

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          can("create:task") ? (
            <Button icon="add" onClick={() => setCreating(true)}>
              {t("actions.new")}
            </Button>
          ) : undefined
        }
      />
      {body}
    </PageContainer>
  );
}
