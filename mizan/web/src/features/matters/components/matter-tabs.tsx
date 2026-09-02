import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { httpClient } from "@/lib/api/http-client";
import { formatDate, formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pill, type PillTone } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MoneyLines } from "@/components/ui/money-lines";
import { MatterChip } from "@/components/ui/matter-chip";
import { DocThumb } from "@/components/ui/doc-thumb";
import { StatCard } from "@/components/ui/stat-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Cell,
  ColumnHeader,
  ListCard,
  ListRow,
  PanelHeader,
  PanelLink,
} from "@/components/tables/list-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { matterKeys } from "../api/matters.api";
import {
  useMatterActivity,
  useMatterFinancials,
  useMatterMutations,
  useMatterNotes,
  useMatterUpdates,
} from "../hooks/use-matters";
import {
  noteSchema,
  updateSchema,
  type NoteFormValues,
  type UpdateFormValues,
} from "../schemas/matter.schema";
import type { Matter } from "../types/matter";

interface ScopedRow {
  id: string;
  [k: string]: unknown;
}

function useMatterScoped<T extends ScopedRow>(matterId: string, resource: string) {
  return useQuery({
    queryKey: matterKeys.tab(matterId, resource),
    queryFn: ({ signal }) =>
      httpClient<{ items: T[] }>(`/${resource}`, { query: { matterId }, signal }).then(
        (r) => r.items,
      ),
  });
}

const HEARING_TONE: Record<string, PillTone> = {
  scheduled: "green",
  adjourned: "gray",
  decided: "blue",
};
const TASK_TONE: Record<string, PillTone> = { todo: "gray", in_progress: "blue", done: "green" };
const PRIORITY_TONE: Record<string, PillTone> = { high: "red", normal: "amber", low: "gray" };

/* ── Overview ─────────────────────────────────────────────────────────────── */

export function MatterOverview({ matter, canWrite }: { matter: Matter; canWrite: boolean }) {
  const { t } = useTranslation("matters");
  const fin = useMatterFinancials(matter.id);

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-3.5">
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center">
              <span className="flex-1 text-[14px] font-extrabold text-foreground">
                {t("detail.case_summary")}
              </span>
              {canWrite && (
                <span className="flex items-center gap-1.5 text-[12px] font-bold text-link">
                  <Icon name="edit" size={16} />
                  {t("common:actions.edit")}
                </span>
              )}
            </div>
            <p className="text-[13px] font-medium leading-[1.72] text-foreground-body text-pretty">
              {matter.description ?? "—"}
            </p>
          </CardBody>
        </Card>

        <MatterTimelineTab id={matter.id} canWrite={canWrite} />
      </div>

      <div className="flex flex-col gap-3.5">
        <Card>
          <PanelHeader
            title={t("detail.assigned_team")}
            action={
              canWrite && (
                <span className="flex items-center gap-1.5 text-[12px] font-bold text-link">
                  <Icon name="person_add" size={16} />
                  {t("detail.assign")}
                </span>
              )
            }
          />
          <CardBody className="flex flex-col gap-3.5">
            {matter.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-[11px]">
                <span className="grid size-[34px] flex-none place-items-center rounded-full bg-border-warm text-[12px] font-extrabold text-primary-deep">
                  {p.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold text-foreground">{p.name}</div>
                  <div className="text-[11px] font-medium text-muted">{p.role}</div>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <PanelHeader title={t("detail.financial_summary")} />
          <CardBody>
            <QueryBoundary query={fin} loading={<RowsSkeleton rows={3} />}>
              {(f) => (
                <div className="flex flex-col gap-[11px]">
                  {(
                    [
                      ["financials.billed", f.billed, false],
                      ["financials.collected", f.collected, false],
                      ["financials.outstanding", f.outstanding, true],
                      ["financials.expenses", f.expenses, false],
                    ] as const
                  ).map(([key, amounts, danger]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-[12.5px] font-semibold text-secondary">{t(key)}</span>
                      <MoneyLines
                        amounts={amounts}
                        align="end"
                        className={
                          danger
                            ? "text-[13px] font-extrabold text-danger"
                            : "text-[13px] font-extrabold text-foreground"
                        }
                      />
                    </div>
                  ))}
                  <Link
                    to="?tab=financials"
                    className="mt-3.5 flex h-[34px] items-center justify-center rounded-md border border-border-control text-[12.5px] font-bold text-foreground hover:bg-surface-subtle"
                  >
                    {t("detail.open_billing")}
                  </Link>
                </div>
              )}
            </QueryBoundary>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/* ── Hearings ─────────────────────────────────────────────────────────────── */

export function MatterHearingsTab({ id }: { id: string }) {
  const { t } = useTranslation("matters");
  const q = useMatterScoped<ScopedRow>(id, "hearings");
  const columns = [
    { key: "date", label: t("hearings:columns.date"), width: 120 },
    { key: "court", label: t("hearings:columns.court"), flex: 1 },
    { key: "type", label: t("hearings:columns.type"), width: 130 },
    { key: "status", label: t("hearings:columns.status"), width: 120 },
  ] as const;

  return (
    <QueryBoundary
      query={q}
      loading={<RowsSkeleton rows={3} />}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon="balance" title={t("tabs.no_hearings")} />}
    >
      {(rows) => (
        <ListCard>
          <PanelHeader title={t("tabs.hearings")} />
          <ColumnHeader columns={[...columns]} />
          {rows.map((h) => (
            <ListRow key={h.id}>
              <Cell col={columns[0]} className="font-extrabold text-foreground">
                {formatDate(String(h.scheduledAt), { day: "numeric", month: "short", year: "numeric" })}
              </Cell>
              <Cell col={columns[1]} className="truncate">
                {String(h.court)}
              </Cell>
              <Cell col={columns[2]} className="truncate">
                {String(h.purpose)}
              </Cell>
              <Cell col={columns[3]}>
                <Pill tone={HEARING_TONE[String(h.status)] ?? "gray"}>
                  {t(`hearings:status.${h.status}`, { defaultValue: String(h.status) })}
                </Pill>
              </Cell>
            </ListRow>
          ))}
        </ListCard>
      )}
    </QueryBoundary>
  );
}

/* ── Tasks ────────────────────────────────────────────────────────────────── */

export function MatterTasksTab({ id }: { id: string }) {
  const { t } = useTranslation("matters");
  const q = useMatterScoped<ScopedRow>(id, "tasks");
  const columns = [
    { key: "task", label: t("tasks:columns.task"), flex: 1 },
    { key: "assignee", label: t("tasks:columns.assignee"), width: 140 },
    { key: "due", label: t("tasks:columns.due"), width: 110 },
    { key: "priority", label: t("tasks:columns.priority"), width: 90 },
    { key: "status", label: t("tasks:columns.status"), width: 110 },
  ] as const;

  return (
    <QueryBoundary
      query={q}
      loading={<RowsSkeleton rows={3} />}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon="task_alt" title={t("tabs.no_tasks")} />}
    >
      {(rows) => (
        <ListCard>
          <PanelHeader title={t("tabs.tasks")} />
          <ColumnHeader columns={[...columns]} />
          {rows.map((k) => (
            <ListRow key={k.id}>
              <Cell col={columns[0]} className="flex items-center gap-[11px]">
                <span className="size-[17px] flex-none rounded-xs border-[1.6px] border-checkbox" />
                <span
                  className={`truncate text-[13px] font-bold ${
                    k.status === "done" ? "text-muted line-through" : "text-foreground"
                  }`}
                >
                  {String(k.title)}
                </span>
              </Cell>
              <Cell col={columns[1]} className="truncate">
                {k.assignee ? String(k.assignee) : t("tabs.unassigned")}
              </Cell>
              <Cell col={columns[2]} className={k.overdue ? "font-bold text-danger" : ""}>
                {k.dueAt ? formatDate(String(k.dueAt), { day: "numeric", month: "short" }) : "—"}
              </Cell>
              <Cell col={columns[3]}>
                <Pill tone={PRIORITY_TONE[String(k.priority)] ?? "gray"}>
                  {t(`tasks:priority.${k.priority}`, { defaultValue: String(k.priority) })}
                </Pill>
              </Cell>
              <Cell col={columns[4]}>
                <Pill tone={TASK_TONE[String(k.status)] ?? "gray"}>
                  {t(`tasks:status.${k.status}`, { defaultValue: String(k.status) })}
                </Pill>
              </Cell>
            </ListRow>
          ))}
        </ListCard>
      )}
    </QueryBoundary>
  );
}

/* ── Documents ────────────────────────────────────────────────────────────── */

export function MatterDocumentsTab({ id, count }: { id: string; count?: number }) {
  const { t } = useTranslation("matters");
  const q = useMatterScoped<ScopedRow>(id, "documents");
  return (
    <QueryBoundary
      query={q}
      loading={<RowsSkeleton rows={3} />}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon="folder_open" title={t("tabs.no_documents")} />}
    >
      {(rows) => (
        <Card>
          <CardBody>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex-1 text-[14px] font-extrabold text-foreground">
                {t("tabs.documents")}{" "}
                <span className="font-bold text-muted">{count ?? rows.length}</span>
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
              {rows.map((d) => (
                <DocThumb
                  key={d.id}
                  name={String(d.name)}
                  meta={`${String(d.category)} · ${formatRelative(String(d.uploadedAt))}`}
                />
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </QueryBoundary>
  );
}

/* ── Timeline (updates) ───────────────────────────────────────────────────── */

export function MatterTimelineTab({ id, canWrite }: { id: string; canWrite: boolean }) {
  const { t } = useTranslation("matters");
  const q = useMatterUpdates(id);
  const { addUpdate } = useMatterMutations(id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateFormValues>({ resolver: zodResolver(updateSchema) });

  return (
    <Card>
      <PanelHeader
        title={t("detail.timeline")}
        action={
          canWrite && (
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-link">
              <Icon name="add" size={16} />
              {t("timeline.add")}
            </span>
          )
        }
      />
      <CardBody className="flex flex-col gap-3.5">
        {canWrite && (
          <form
            onSubmit={handleSubmit(async (v) => {
              await addUpdate.mutateAsync({ body: v.body });
              reset();
            })}
            noValidate
            className="flex flex-col gap-2 rounded-panel border border-border-control p-3"
          >
            <Textarea
              rows={2}
              placeholder={t("timeline.placeholder")}
              invalid={!!errors.body}
              {...register("body")}
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={isSubmitting}>
                {t("timeline.add")}
              </Button>
            </div>
          </form>
        )}

        <QueryBoundary
          query={q}
          loading={<RowsSkeleton rows={3} />}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon="timeline" title={t("tabs.no_updates")} />}
        >
          {(updates) => (
            <div className="flex flex-col gap-3">
              {updates.map((u) => (
                <div key={u.id} className="rounded-panel border border-border-nested p-[15px]">
                  <div className="text-[13px] font-extrabold text-foreground">
                    {u.body.split("\n")[0].slice(0, 80)}
                  </div>
                  <div className="mt-1.5 text-[12.5px] font-medium leading-[1.65] text-foreground-body-2">
                    {u.body}
                  </div>
                  <div className="mt-2.5 text-[11px] font-semibold text-muted">
                    {u.author} · {formatDate(u.createdAt)}
                  </div>
                  {u.documents.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {u.documents.map((d) => (
                        <span
                          key={d.id}
                          className="flex items-center gap-1.5 rounded-md border border-border bg-surface-subtle px-2.5 py-1.5 text-[11.5px] font-bold"
                        >
                          <Icon name="attach_file" size={15} className="text-muted" />
                          {d.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </QueryBoundary>
      </CardBody>
    </Card>
  );
}

/* ── Notes ────────────────────────────────────────────────────────────────── */

export function MatterNotesTab({ id, canWrite }: { id: string; canWrite: boolean }) {
  const { t } = useTranslation("matters");
  const q = useMatterNotes(id);
  const { addNote, deleteNote } = useMatterMutations(id);
  const [deleting, setDeleting] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NoteFormValues>({ resolver: zodResolver(noteSchema) });

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardBody>
          <div className="mb-3.5 text-[14px] font-extrabold text-foreground">{t("tabs.notes")}</div>
          {canWrite && (
            <form
              onSubmit={handleSubmit(async (v) => {
                await addNote.mutateAsync({ body: v.body });
                reset();
              })}
              noValidate
              className="mb-4 flex flex-col gap-2 rounded-panel border border-border-control p-3"
            >
              <Textarea
                rows={2}
                placeholder={t("notes.placeholder")}
                invalid={!!errors.body}
                {...register("body")}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" loading={isSubmitting}>
                  {t("notes.add")}
                </Button>
              </div>
            </form>
          )}
          <QueryBoundary
            query={q}
            loading={<RowsSkeleton rows={2} />}
            isEmpty={(d) => d.length === 0}
            empty={<EmptyState icon="sticky_note_2" title={t("tabs.no_notes")} />}
          >
            {(notes) => (
              <div className="flex flex-col gap-3">
                {notes.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-panel border border-border-nested bg-surface-subtle-2 p-[15px]"
                  >
                    <p className="whitespace-pre-wrap text-[12.5px] font-medium leading-[1.65] text-foreground-body">
                      {n.body}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-muted">
                      <span>
                        {n.author} · {formatDate(n.createdAt)}
                      </span>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => setDeleting(n.id)}
                          aria-label={t("common:actions.delete")}
                          className="text-muted hover:text-danger"
                        >
                          <Icon name="delete" size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </QueryBoundary>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("notes.delete_title")}
        confirmLabel={t("common:actions.delete")}
        destructive
        onConfirm={async () => {
          if (deleting) await deleteNote.mutateAsync(deleting);
          setDeleting(null);
        }}
      />
    </div>
  );
}

/* ── Financials ───────────────────────────────────────────────────────────── */

export function MatterFinancialsTab({ id }: { id: string }) {
  const { t } = useTranslation("matters");
  const q = useMatterFinancials(id);
  return (
    <QueryBoundary query={q} loading={<RowsSkeleton rows={3} />}>
      {(fin) => (
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <StatCard label={t("financials.billed")} value={fin.billed.length ? fin.billed.map((m) => `${m.currency} ${m.amount}`) : ["—"]} />
            <StatCard label={t("financials.collected")} value={fin.collected.length ? fin.collected.map((m) => `${m.currency} ${m.amount}`) : ["—"]} />
            <StatCard
              label={t("financials.outstanding")}
              value={fin.outstanding.length ? fin.outstanding.map((m) => `${m.currency} ${m.amount}`) : ["—"]}
              valueTone="danger"
            />
            <StatCard label={t("financials.expenses")} value={fin.expenses.length ? fin.expenses.map((m) => `${m.currency} ${m.amount}`) : ["—"]} />
          </div>
          {fin.invoices.length > 0 ? (
            <ListCard>
              <PanelHeader
                title={t("tabs.financials")}
                action={<PanelLink to="/billing">{t("detail.open_billing")}</PanelLink>}
              />
              {fin.invoices.map((inv) => (
                <ListRow key={inv.id}>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/billing/invoices/${inv.id}`}
                      className="text-[13px] font-extrabold text-link"
                    >
                      {inv.number}
                    </Link>
                  </div>
                  <Pill tone={inv.status === "paid" ? "green" : inv.status === "void" ? "gray" : "blue"}>
                    {t(`billing:status.${inv.status}`, { defaultValue: inv.status })}
                  </Pill>
                </ListRow>
              ))}
            </ListCard>
          ) : (
            <EmptyState icon="receipt_long" title={t("tabs.no_invoices")} />
          )}
        </div>
      )}
    </QueryBoundary>
  );
}

/* ── Activity ─────────────────────────────────────────────────────────────── */

export function MatterActivityTab({ id }: { id: string }) {
  const { t } = useTranslation("matters");
  const q = useMatterActivity(id);
  return (
    <QueryBoundary
      query={q}
      loading={<RowsSkeleton rows={4} />}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon="history" title={t("tabs.no_activity")} />}
    >
      {(entries) => (
        <Card>
          <CardBody className="p-5">
            <div className="mb-4 text-[14px] font-extrabold text-foreground">{t("tabs.activity")}</div>
            <div className="flex flex-col">
              {entries.map((e, i) => (
                <div key={e.id} className="flex gap-3.5">
                  <div className="flex flex-none flex-col items-center gap-1.5">
                    <span className="grid size-8 flex-none place-items-center rounded-full bg-surface-warm-2 text-link">
                      <Icon name="history" size={17} />
                    </span>
                    {i < entries.length - 1 && <span className="w-px flex-1 bg-divider-row" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-4">
                    <div className="text-[13px] font-bold text-foreground">
                      {t(`dashboard:activity.${e.action}`, {
                        defaultValue: e.action.replace(/[._]/g, " "),
                      })}
                      {" — "}
                      <span className="font-semibold text-foreground-body">{e.target}</span>
                    </div>
                    <div className="mt-0.5 text-[11.5px] font-medium text-muted">
                      {e.actor} · {formatRelative(e.at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </QueryBoundary>
  );
}

/* MatterChip is re-exported for tabs that show a matter number inline. */
export { MatterChip };
