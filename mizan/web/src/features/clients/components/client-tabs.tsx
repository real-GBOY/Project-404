import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { formatDate, formatMoney, formatRelative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
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

const listWrap = "divide-y divide-divider rounded-lg border border-border bg-surface";
const row = "flex items-center gap-3 px-4 py-3";

export function MattersTab({ id }: { id: string }) {
  const { t } = useTranslation("clients");
  const q = useClientMatters(id);
  return (
    <QueryBoundary
      query={q}
      loading={<RowsSkeleton rows={4} />}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon="gavel" title={t("tabs.no_matters")} />}
    >
      {(matters) => (
        <div className={listWrap}>
          {matters.map((m) => (
            <Link key={m.id} to={`/matters/${m.id}`} className={`${row} hover:bg-surface-subtle`}>
              <Icon name="gavel" size={16} className="flex-none text-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold text-foreground">{m.title}</div>
                <div className="text-[11.5px] text-muted">
                  {m.reference} · {m.practiceArea} · {formatDate(m.openedAt)}
                </div>
              </div>
              <Badge tone={m.status === "open" ? "info" : m.status === "closed" ? "neutral" : "warning"} size="sm">
                {t(`matters:status.${m.status}`, { defaultValue: m.status })}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </QueryBoundary>
  );
}

export function DocumentsTab({ id }: { id: string }) {
  const { t } = useTranslation("clients");
  const q = useClientDocuments(id);
  return (
    <QueryBoundary
      query={q}
      loading={<RowsSkeleton rows={4} />}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon="folder_open" title={t("tabs.no_documents")} />}
    >
      {(docs) => (
        <div className={listWrap}>
          {docs.map((d) => (
            <div key={d.id} className={row}>
              <Icon name="description" size={16} className="flex-none text-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold text-foreground">{d.name}</div>
                <div className="text-[11.5px] text-muted">
                  {d.matterTitle} · {d.category} · {formatRelative(d.uploadedAt)}
                </div>
              </div>
              <Badge tone="neutral" size="sm">
                {d.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </QueryBoundary>
  );
}

export function BillingTab({ id }: { id: string }) {
  const { t } = useTranslation("clients");
  const q = useClientBilling(id);
  return (
    <QueryBoundary
      query={q}
      loading={<RowsSkeleton rows={3} />}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon="request_quote" title={t("tabs.no_invoices")} />}
    >
      {(invoices) => (
        <div className={listWrap}>
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              to={`/billing/invoices/${inv.id}`}
              className={`${row} hover:bg-surface-subtle`}
            >
              <Icon name="receipt_long" size={16} className="flex-none text-muted" />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-foreground">{inv.number}</div>
                <div className="text-[11.5px] text-muted">
                  {inv.issuedAt ? formatDate(inv.issuedAt) : t("tabs.not_issued")}
                </div>
              </div>
              <div className="text-end">
                <div className="text-[12.5px] font-semibold tabular-nums text-foreground">
                  {formatMoney({ currency: inv.currency, amount: String(inv.total) })}
                </div>
                {inv.balance > 0 && (
                  <div className="text-[11px] text-warning">
                    {t("tabs.balance", {
                      amount: formatMoney({ currency: inv.currency, amount: String(inv.balance) }),
                    })}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </QueryBoundary>
  );
}

export function ActivityTab({ id }: { id: string }) {
  const { t } = useTranslation("clients");
  const q = useClientActivity(id);
  return (
    <QueryBoundary
      query={q}
      loading={<RowsSkeleton rows={5} />}
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-foreground">{t("tabs.contacts")}</h3>
        {canManage && !adding && (
          <Button size="sm" variant="secondary" icon="person_add" onClick={() => setAdding(true)}>
            {t("tabs.add_contact")}
          </Button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-3 rounded-lg border border-border bg-surface-subtle p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t("fields.name")} required error={errors.name && t(errors.name.message ?? "")}>
              <Input {...register("name")} />
            </FormField>
            <FormField label={t("fields.contact_role")}>
              <Input {...register("role")} />
            </FormField>
            <FormField label={t("fields.email")} error={errors.email && t(errors.email.message ?? "")}>
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
          <div className={listWrap}>
            {contacts.map((c) => (
              <div key={c.id} className={row}>
                <Avatar name={c.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12.5px] font-semibold text-foreground">{c.name}</span>
                    {c.primary && (
                      <Badge tone="brand" size="sm">
                        {t("tabs.primary")}
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11.5px] text-muted">
                    {[c.role, c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
