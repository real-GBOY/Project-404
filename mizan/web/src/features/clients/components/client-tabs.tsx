import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { formatDate, formatMoney, formatMoneyList, formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Pill, type PillTone } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { MatterChip } from "@/components/ui/matter-chip";
import { StatCard } from "@/components/ui/stat-card";
import { DocThumb } from "@/components/ui/doc-thumb";
import {
  Cell,
  ColumnHeader,
  ListCard,
  ListRow,
  PanelHeader,
  PanelLink,
} from "@/components/tables/list-card";
import { FilterPopover } from "@/components/tables/filter-popover";
import { UploadDocumentDialog } from "@/features/documents/components/document-dialogs";
import { useDocumentDownload } from "@/features/documents/hooks/use-documents";
import { FormField } from "@/components/forms/form-field";
import { EmptyState } from "@/components/feedback/empty-state";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import {
  useClientActivity,
  useClientBilling,
  useClientContacts,
  useClientDocuments,
  useClientMatters,
  useClientMutations,
} from "../hooks/use-clients";
import { contactSchema, type ContactFormValues } from "../schemas/client.schema";
import type { Client } from "../types/client";

const MATTER_TONE: Record<string, PillTone> = {
  open: "green",
  on_hold: "amber",
  closed: "gray",
};

const INVOICE_TONE: Record<string, PillTone> = {
  paid: "green",
  sent: "blue",
  issued: "blue",
  void: "gray",
  draft: "gray",
};

/* ── Overview: client information panel ──────────────────────────────────── */

export function OverviewInfo({ client }: { client: Client }) {
  const { t } = useTranslation("clients");
  const contact = client.primaryContact;
  const field = "text-[13px] font-bold text-foreground";
  const label = "mb-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-subtle";

  return (
    <Card>
      <PanelHeader title={t("detail.client_information")} />
      <CardBody>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className={label}>{t("detail.primary_contact")}</div>
            <div className={field}>{contact?.name ?? "—"}</div>
            {contact?.role && (
              <div className="text-[11.5px] font-medium text-muted">{contact.role}</div>
            )}
          </div>
          <div>
            <div className={label}>{t("detail.email")}</div>
            <div className={field}>{client.email ?? "—"}</div>
          </div>
          <div>
            <div className={label}>{t("detail.telephone")}</div>
            <div className={field}>{client.phone ?? "—"}</div>
          </div>
          <div>
            <div className={label}>{t("fields.address")}</div>
            <div className={field}>{client.address ?? "—"}</div>
          </div>
          <div>
            <div className={label}>{t("detail.registration")}</div>
            <div className={field}>{client.registration}</div>
          </div>
          <div>
            <div className={label}>{t("fields.type")}</div>
            <div className={field}>{t(`type.${client.type}`)}</div>
          </div>
        </div>
        {client.notes && (
          <p className="mt-3.5 border-t border-divider pt-3.5 text-[12.5px] font-medium leading-[1.7] text-foreground-body">
            {client.notes}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

/* ── Matters ─────────────────────────────────────────────────────────────── */

export function MattersTab({ id, compact = false }: { id: string; compact?: boolean }) {
  const { t } = useTranslation("clients");
  const navigate = useNavigate();
  const q = useClientMatters(id);

  return (
    <QueryBoundary
      query={q}
      loading={<RowsSkeleton rows={4} />}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon="gavel" title={t("tabs.no_matters")} />}
    >
      {(matters) => {
        const rows = compact ? matters.filter((m) => m.status !== "closed").slice(0, 4) : matters;
        const columns = [
          { key: "no", label: t("detail.col_no"), width: 100 },
          { key: "title", label: t("detail.col_title"), flex: 1 },
          { key: "type", label: t("detail.col_type"), width: 110 },
          { key: "lead", label: t("detail.col_lead"), width: 130 },
          { key: "next", label: t("detail.col_status"), width: 110 },
          { key: "status", label: t("detail.col_status"), width: 100 },
        ] as const;

        return (
          <ListCard>
            <PanelHeader
              title={compact ? t("detail.open_matters") : t("tabs.matters")}
              action={<PanelLink to="/matters">{t("detail.all_matters")}</PanelLink>}
            />
            {!compact && <ColumnHeader columns={[...columns]} />}
            {rows.map((m) =>
              compact ? (
                <ListRow key={m.id} onClick={() => navigate(`/matters/${m.id}`)}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-foreground">{m.title}</div>
                    <div className="mt-0.5 truncate text-[11.5px] font-medium text-muted">
                      {m.reference} · {m.practiceArea}
                      {m.court ? ` · ${m.court}` : ""}
                    </div>
                  </div>
                  <div className="flex-none text-end">
                    <div className="text-[11.5px] font-bold text-foreground">
                      {m.nextHearing
                        ? formatDate(m.nextHearing, { day: "numeric", month: "short" })
                        : "—"}
                    </div>
                    <div className="text-[10.5px] font-semibold text-muted">
                      {t("detail.next_hearing")}
                    </div>
                  </div>
                  <Pill tone={MATTER_TONE[m.status] ?? "gray"}>{t(`mstatus.${m.status}`)}</Pill>
                </ListRow>
              ) : (
                <ListRow key={m.id} onClick={() => navigate(`/matters/${m.id}`)}>
                  <Cell col={columns[0]}>
                    <MatterChip>{m.reference}</MatterChip>
                  </Cell>
                  <Cell col={columns[1]}>
                    <div className="truncate text-[13px] font-bold text-foreground">{m.title}</div>
                    <div className="truncate text-[11px] font-medium text-muted">{m.court ?? "—"}</div>
                  </Cell>
                  <Cell col={columns[2]} className="truncate">
                    {m.practiceArea}
                  </Cell>
                  <Cell col={columns[3]} className="truncate">
                    {m.leadLawyer}
                  </Cell>
                  <Cell col={columns[4]} className="font-bold text-foreground">
                    {m.nextHearing
                      ? formatDate(m.nextHearing, { day: "numeric", month: "short" })
                      : "—"}
                  </Cell>
                  <Cell col={columns[5]}>
                    <Pill tone={MATTER_TONE[m.status] ?? "gray"}>{t(`mstatus.${m.status}`)}</Pill>
                  </Cell>
                </ListRow>
              ),
            )}
          </ListCard>
        );
      }}
    </QueryBoundary>
  );
}

/* ── Documents ───────────────────────────────────────────────────────────── */

export function DocumentsTab({ id, count }: { id: string; count?: number }) {
  const { t } = useTranslation("clients");
  const q = useClientDocuments(id);
  const download = useDocumentDownload();
  const [category, setCategory] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);

  return (
    <QueryBoundary
      query={q}
      loading={<RowsSkeleton rows={4} />}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon="folder_open" title={t("tabs.no_documents")} />}
    >
      {(docs) => {
        const categories = [...new Set(docs.map((d) => d.category))].sort();
        const visible = category ? docs.filter((d) => d.category === category) : docs;
        return (
          <Card>
            <CardBody>
              <div className="mb-4 flex flex-wrap items-center gap-2.5">
                <span className="flex-1 text-[14px] font-extrabold text-foreground">
                  {t("detail.client_documents")}{" "}
                  <span className="font-bold text-muted">{count ?? docs.length}</span>
                </span>
                {categories.length > 1 && (
                  <FilterPopover
                    groups={[
                      {
                        key: "category",
                        label: t("columns.category", { defaultValue: "Category" }),
                        options: categories.map((c) => ({ value: c, label: c })),
                      },
                    ]}
                    value={{ category }}
                    onChange={(_k, v) => setCategory(v)}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setUploading(true)}
                  className="flex h-[34px] items-center gap-1.5 rounded-md bg-ink px-[13px] text-[12.5px] font-bold text-ink-foreground"
                >
                  <Icon name="add" size={17} />
                  {t("detail.add_documents")}
                </button>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
                {visible.map((d) => (
                  <DocThumb
                    key={d.id}
                    name={d.name}
                    meta={`${d.category} · ${formatRelative(d.uploadedAt)}`}
                    actions={
                      <button
                        type="button"
                        onClick={() => download.mutate({ id: d.id, name: d.name })}
                        className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-ink text-[12px] font-bold text-ink-foreground"
                      >
                        <Icon name="download" size={16} />
                        {t("detail.download")}
                      </button>
                    }
                  />
                ))}
              </div>
            </CardBody>
            <UploadDocumentDialog open={uploading} onOpenChange={setUploading} />
          </Card>
        );
      }}
    </QueryBoundary>
  );
}

/* ── Billing ─────────────────────────────────────────────────────────────── */

export function BillingTab({ id, client }: { id: string; client: Client }) {
  const { t } = useTranslation("clients");
  const navigate = useNavigate();
  const q = useClientBilling(id);
  const s = client.stats;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label={t("detail.billed_to_date")} value={formatMoneyList(s.billedToDate)} />
        <StatCard
          label={t("detail.outstanding")}
          value={formatMoneyList(s.outstanding)}
          valueTone="danger"
        />
        <StatCard label={t("detail.collected")} value={formatMoneyList(s.collected)} />
        <StatCard
          label={t("detail.unbilled_time")}
          value={`${s.unbilledHours}`}
          unit={t("detail.hrs")}
        />
      </div>

      <QueryBoundary
        query={q}
        loading={<RowsSkeleton rows={4} />}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon="receipt_long" title={t("tabs.no_invoices")} />}
      >
        {(invoices) => {
          const columns = [
            { key: "no", label: "Invoice", width: 150 },
            { key: "issued", label: "Issued", flex: 1 },
            { key: "amount", label: "Amount", width: 130 },
            { key: "status", label: "Status", width: 110 },
          ] as const;
          return (
            <ListCard>
              <PanelHeader title={t("tabs.billing")} />
              <ColumnHeader columns={[...columns]} />
              {invoices.map((inv) => (
                <ListRow key={inv.id} onClick={() => navigate(`/billing/invoices/${inv.id}`)}>
                  <Cell col={columns[0]} className="font-extrabold text-link">
                    {inv.number}
                  </Cell>
                  <Cell col={columns[1]}>
                    {inv.issuedAt ? formatDate(inv.issuedAt) : t("tabs.not_issued")}
                  </Cell>
                  <Cell col={columns[2]} className="text-[13px] font-extrabold text-foreground">
                    {formatMoney({ currency: inv.currency, amount: String(inv.total) })}
                  </Cell>
                  <Cell col={columns[3]}>
                    <Pill tone={INVOICE_TONE[inv.status] ?? "gray"}>
                      {t(`billing:status.${inv.status}`, { defaultValue: inv.status })}
                    </Pill>
                  </Cell>
                </ListRow>
              ))}
            </ListCard>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

/* ── Activity ────────────────────────────────────────────────────────────── */

export function ActivityTab({ id, compact = false }: { id: string; compact?: boolean }) {
  const { t } = useTranslation("clients");
  const q = useClientActivity(id);

  return (
    <QueryBoundary
      query={q}
      loading={<RowsSkeleton rows={5} />}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon="history" title={t("tabs.no_activity")} />}
    >
      {(entries) => {
        const list = compact ? entries.slice(0, 5) : entries;
        return (
          <ListCard>
            <PanelHeader
              icon={compact ? "history" : undefined}
              title={compact ? t("detail.activity_history") : t("detail.full_activity")}
            />
            <div className={compact ? "flex flex-col gap-4 px-[18px] py-4" : "flex flex-col p-5"}>
              {list.map((e, i) => (
                <div key={e.id} className="flex gap-3.5">
                  {!compact && (
                    <div className="flex flex-none flex-col items-center gap-1.5">
                      <span className="grid size-8 flex-none place-items-center rounded-full bg-surface-warm-2 text-link">
                        <Icon name="history" size={17} />
                      </span>
                      {i < list.length - 1 && <span className="w-px flex-1 bg-divider-row" />}
                    </div>
                  )}
                  {compact && (
                    <span className="grid size-7 flex-none place-items-center rounded-full bg-surface-warm-2 text-link">
                      <Icon name="history" size={16} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="text-[12.5px] font-bold leading-[1.4] text-foreground">
                      {t(`dashboard:activity.${e.action}`, {
                        defaultValue: e.action.replace(/[._]/g, " "),
                      })}
                      {" — "}
                      <span className="font-semibold text-foreground-body">{e.target}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-muted">
                      {e.actor} · {formatRelative(e.at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ListCard>
        );
      }}
    </QueryBoundary>
  );
}

/* ── Communications (contacts) ───────────────────────────────────────────── */

export function CommunicationsTab({ client, canManage }: { client: Client; canManage: boolean }) {
  const { t } = useTranslation("clients");
  const q = useClientContacts(client.id);
  const [adding, setAdding] = useState(false);
  const { addContact } = useClientMutations(client.id);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({ resolver: zodResolver(contactSchema) });

  async function onSubmit(values: ContactFormValues) {
    await addContact.mutateAsync(values);
    reset();
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-3.5">
      {adding && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-3 rounded-card border border-border bg-surface-subtle p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label={t("fields.name")}
              required
              error={errors.name && t(errors.name.message ?? "")}
            >
              <Input {...register("name")} />
            </FormField>
            <FormField label={t("fields.contact_role")}>
              <Input {...register("role")} />
            </FormField>
            <FormField
              label={t("fields.email")}
              error={errors.email && t(errors.email.message ?? "")}
            >
              <Input type="email" {...register("email")} />
            </FormField>
            <FormField label={t("fields.phone")}>
              <Input {...register("phone")} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-[12.5px]">
            <Checkbox
              checked={!!watch("primary")}
              onCheckedChange={(v) => setValue("primary", v === true)}
              aria-label={t("fields.primary_contact")}
            />
            {t("fields.primary_contact")}
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" size="sm" loading={isSubmitting}>
              {t("common:actions.add")}
            </Button>
          </div>
        </form>
      )}

      <QueryBoundary
        query={q}
        loading={<RowsSkeleton rows={3} />}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon="contacts" title={t("tabs.no_contacts")} />}
      >
        {(contacts) => (
          <ListCard>
            <PanelHeader
              title={t("tabs.contacts")}
              action={
                canManage &&
                !adding && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="person_add"
                    onClick={() => setAdding(true)}
                  >
                    {t("tabs.add_contact")}
                  </Button>
                )
              }
            />
            {contacts.map((c) => (
              <ListRow key={c.id}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12.5px] font-bold text-foreground">{c.name}</span>
                    {c.primary && <Pill tone="purple">{t("tabs.primary")}</Pill>}
                  </div>
                  <div className="text-[11.5px] font-medium text-muted">
                    {[c.role, c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
              </ListRow>
            ))}
          </ListCard>
        )}
      </QueryBoundary>
    </div>
  );
}
