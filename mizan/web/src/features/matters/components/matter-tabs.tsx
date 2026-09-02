import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { httpClient } from "@/lib/api/http-client";
import { formatDate, formatRelative } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Textarea } from "@/components/ui/textarea";
import { MoneyLines } from "@/components/ui/money-lines";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { noteSchema, updateSchema, type NoteFormValues, type UpdateFormValues } from "../schemas/matter.schema";
import type { Matter } from "../types/matter";

const listWrap = "divide-y divide-divider rounded-lg border border-border bg-surface";
const row = "flex items-center gap-3 px-4 py-3";

interface ScopedRow {
  id: string;
  [k: string]: unknown;
}

function useMatterScoped<T extends ScopedRow>(matterId: string, resource: string) {
  return useQuery({
    queryKey: matterKeys.tab(matterId, resource),
    queryFn: ({ signal }) =>
      httpClient<{ items: T[] }>(`/${resource}`, { query: { matterId }, signal }).then((r) => r.items),
  });
}

/* ── Hearings ── */
export function MatterHearingsTab({ id }: { id: string }) {
  const { t } = useTranslation("matters");
  const q = useMatterScoped<ScopedRow>(id, "hearings");
  return (
    <QueryBoundary
      query={q}
      loading={<RowsSkeleton rows={3} />}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon="event" title={t("tabs.no_hearings")} />}
    >
      {(rows) => (
        <div className={listWrap}>
          {rows.map((h) => (
            <div key={h.id} className={row}>
              <div className="flex w-11 flex-none flex-col items-center rounded-md bg-surface-sand py-1 text-link">
                <span className="text-[14px] font-extrabold leading-none">
                  {formatDate(String(h.scheduledAt), { day: "2-digit" })}
                </span>
                <span className="text-[9px] font-bold uppercase">
                  {formatDate(String(h.scheduledAt), { month: "short" })}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-foreground">{String(h.purpose)}</div>
                <div className="text-[11.5px] text-muted">
                  {String(h.court)} · {formatDate(String(h.scheduledAt), { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <Badge
                tone={h.status === "scheduled" ? "info" : h.status === "decided" ? "success" : "neutral"}
                size="sm"
              >
                {t(`hearings:status.${h.status}`, { defaultValue: String(h.status) })}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </QueryBoundary>
  );
}

/* ── Tasks ── */
export function MatterTasksTab({ id }: { id: string }) {
  const { t } = useTranslation("matters");
  const q = useMatterScoped<ScopedRow>(id, "tasks");
  return (
    <QueryBoundary
      query={q}
      loading={<RowsSkeleton rows={3} />}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon="task_alt" title={t("tabs.no_tasks")} />}
    >
      {(rows) => (
        <div className={listWrap}>
          {rows.map((k) => (
            <div key={k.id} className={row}>
              <Icon
                name={k.status === "done" ? "check_circle" : "radio_button_unchecked"}
                size={16}
                className={k.status === "done" ? "text-success" : "text-subtle"}
              />
              <div className="min-w-0 flex-1">
                <div
                  className={`text-[12.5px] font-semibold ${k.status === "done" ? "text-muted line-through" : "text-foreground"}`}
                >
                  {String(k.title)}
                </div>
                <div className="text-[11.5px] text-muted">
                  {k.assignee ? String(k.assignee) : t("tabs.unassigned")}
                  {k.dueAt ? ` · ${formatRelative(String(k.dueAt))}` : ""}
                </div>
              </div>
              {k.overdue ? <Badge tone="danger" size="sm">{t("common:time.overdue")}</Badge> : null}
            </div>
          ))}
        </div>
      )}
    </QueryBoundary>
  );
}

/* ── Documents ── */
export function MatterDocumentsTab({ id }: { id: string }) {
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
        <div className={listWrap}>
          {rows.map((d) => (
            <div key={d.id} className={row}>
              <Icon name="description" size={16} className="flex-none text-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold text-foreground">{String(d.name)}</div>
                <div className="text-[11.5px] text-muted">
                  {String(d.category)} · {formatRelative(String(d.uploadedAt))}
                </div>
              </div>
              <Badge tone="neutral" size="sm">
                {String(d.status)}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </QueryBoundary>
  );
}

/* ── Timeline (updates) ── */
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
    <div className="flex flex-col gap-4">
      {canWrite && (
        <form
          onSubmit={handleSubmit(async (v) => {
            await addUpdate.mutateAsync({ body: v.body });
            reset();
          })}
          noValidate
          className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3"
        >
          <Textarea
            rows={2}
            placeholder={t("timeline.placeholder")}
            invalid={!!errors.body}
            {...register("body")}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" icon="add_comment" loading={isSubmitting}>
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
          <ol className="relative flex flex-col gap-4 border-s border-divider ps-5">
            {updates.map((u) => (
              <li key={u.id} className="relative">
                <span className="absolute -start-[1.6rem] top-1 flex size-3 items-center justify-center rounded-full border-2 border-surface bg-border-accent" />
                <div className="flex items-center gap-2 text-[11.5px] text-muted">
                  <span className="font-semibold text-foreground-body">{u.author}</span>
                  <span>{formatRelative(u.createdAt)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-foreground-body">{u.body}</p>
                {u.documents.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {u.documents.map((d) => (
                      <Link
                        key={d.id}
                        to="/documents"
                        className="inline-flex items-center gap-1 rounded-md bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-link"
                      >
                        <Icon name="attach_file" size={12} />
                        {d.name}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </QueryBoundary>
    </div>
  );
}

/* ── Notes ── */
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
    <div className="flex flex-col gap-4">
      {canWrite && (
        <form
          onSubmit={handleSubmit(async (v) => {
            await addNote.mutateAsync({ body: v.body });
            reset();
          })}
          noValidate
          className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3"
        >
          <Textarea rows={2} placeholder={t("notes.placeholder")} invalid={!!errors.body} {...register("body")} />
          <div className="flex justify-end">
            <Button type="submit" size="sm" icon="add" loading={isSubmitting}>
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
          <div className="flex flex-col gap-2">
            {notes.map((n) => (
              <div key={n.id} className="rounded-lg border border-border bg-surface-warm p-3">
                <div className="flex items-center justify-between text-[11.5px] text-muted">
                  <span>
                    <span className="font-semibold text-foreground-body">{n.author}</span> ·{" "}
                    {formatRelative(n.createdAt)}
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
                <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-foreground-body">{n.body}</p>
              </div>
            ))}
          </div>
        )}
      </QueryBoundary>
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

/* ── Financials ── */
export function MatterFinancialsTab({ id }: { id: string }) {
  const { t } = useTranslation("matters");
  const q = useMatterFinancials(id);
  return (
    <QueryBoundary query={q} loading={<RowsSkeleton rows={3} />}>
      {(fin) => (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              [
                ["billed", fin.billed],
                ["collected", fin.collected],
                ["outstanding", fin.outstanding],
                ["expenses", fin.expenses],
              ] as const
            ).map(([key, amounts]) => (
              <div key={key} className="rounded-lg border border-border bg-surface p-3">
                <div className="text-[11px] font-semibold text-muted">{t(`financials.${key}`)}</div>
                <MoneyLines amounts={amounts} className="mt-1 text-[13.5px] font-bold" />
              </div>
            ))}
          </div>
          {fin.invoices.length > 0 ? (
            <div className={listWrap}>
              {fin.invoices.map((inv) => (
                <Link
                  key={inv.id}
                  to={`/billing/invoices/${inv.id}`}
                  className={`${row} hover:bg-surface-subtle`}
                >
                  <Icon name="receipt_long" size={16} className="flex-none text-muted" />
                  <div className="flex-1 text-[12.5px] font-semibold text-foreground">{inv.number}</div>
                  <Badge tone="neutral" size="sm">
                    {inv.status}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon="request_quote" title={t("tabs.no_invoices")} />
          )}
        </div>
      )}
    </QueryBoundary>
  );
}

/* ── Activity ── */
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
        <ul className="flex flex-col gap-3">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start gap-3">
              <Avatar name={e.actor} size="xs" className="mt-0.5" />
              <div>
                <p className="text-[12.5px] text-foreground-body">
                  <span className="font-semibold text-foreground">{e.actor}</span>{" "}
                  {e.action.replace(/[._]/g, " ")} <span className="font-medium">{e.target}</span>
                </p>
                <p className="text-[11px] text-muted">{formatRelative(e.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </QueryBoundary>
  );
}

/* ── Overview: participants ── */
export function MatterParticipants({ matter, canWrite }: { matter: Matter; canWrite: boolean }) {
  const { t } = useTranslation("matters");
  const { removeParticipant } = useMatterMutations(matter.id);
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 text-[11.5px] font-semibold text-muted">{t("overview.team")}</div>
      <ul className="flex flex-col gap-2">
        {matter.participants.map((p) => (
          <li key={p.id} className="flex items-center gap-2.5">
            <Avatar name={p.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-foreground">{p.name}</div>
              <div className="text-[11px] text-muted">{p.role}</div>
            </div>
            {canWrite && p.role !== "Lead" && (
              <button
                type="button"
                onClick={() => removeParticipant.mutate(p.id)}
                aria-label={t("common:actions.delete")}
                className="text-muted hover:text-danger"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
