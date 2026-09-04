import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useSetPageChrome } from "@/lib/page-chrome";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatDate, formatMoneyList } from "@/lib/format";
import { PageContainer } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/badge";
import { MoneyLines } from "@/components/ui/money-lines";
import { DetailField } from "@/components/ui/detail-field";
import { PanelHeader } from "@/components/tables/list-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { Skeleton } from "@/components/feedback/skeleton";
import { MatterFormDialog } from "@/features/matters/components/matter-form-dialog";
import { useClient, useClientMutations } from "../hooks/use-clients";
import { ClientFormDialog } from "../components/client-form-dialog";
import {
  ActivityTab,
  BillingTab,
  CommunicationsTab,
  DocumentsTab,
  MattersTab,
  OverviewInfo,
} from "../components/client-tabs";
import type { Client } from "../types/client";

const TABS = ["overview", "matters", "documents", "communications", "billing", "activity"] as const;

function initials(name: string) {
  return name
    .replace(/[^A-Za-z ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function ClientHero({
  client,
  canManage,
  onEdit,
  onArchive,
  onNewMatter,
}: {
  client: Client;
  canManage: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onNewMatter: () => void;
}) {
  const { t } = useTranslation("clients");
  const since = formatDate(client.createdAt, { month: "long", year: "numeric" });
  const contactEmail = client.email ?? client.primaryContact?.email ?? null;
  return (
    <Card>
      <CardBody className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-14 flex-none place-items-center rounded-card bg-surface-sand text-[18px] font-extrabold text-link">
            {initials(client.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[20px] font-extrabold tracking-[-0.02em] text-foreground">
                {client.name}
              </span>
              <Pill tone={client.status === "active" ? "green" : "gray"}>
                {t(`status.${client.status}`)}
              </Pill>
            </div>
            <div className="mt-1 text-[12.5px] font-medium text-muted">
              {t(`type.${client.type}`)} {t("client_since_word", { defaultValue: "client since" })}{" "}
              {since} · {client.registration}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t("actions.more")}
                  className="flex size-9 items-center justify-center rounded-btn border border-border-control text-secondary hover:bg-surface-subtle"
                >
                  <Icon name="more_vert" size={18} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem icon="edit" onSelect={onEdit}>
                    {t("common:actions.edit")}
                  </DropdownMenuItem>
                  {client.status === "active" && (
                    <DropdownMenuItem icon="archive" destructive onSelect={onArchive}>
                      {t("actions.archive")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {contactEmail && (
              <Button
                variant="secondary"
                size="sm"
                icon="mail"
                onClick={() => {
                  window.location.href = `mailto:${contactEmail}`;
                }}
              >
                {t("detail.send_message")}
              </Button>
            )}
            {canManage && (
              <Button size="sm" icon="add" onClick={onNewMatter}>
                {t("detail.new_matter")}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-divider pt-4.5 md:grid-cols-3 lg:grid-cols-5">
          <DetailField label={t("detail.relationship_partner")}>{client.partner ?? "—"}</DetailField>
          <DetailField label={t("detail.open_matters")}>
            <span className="text-[14px] font-extrabold">{client.stats.openMatters}</span>{" "}
            <span className="text-[11.5px] font-semibold text-muted">
              {t("detail.open_of", { total: client.stats.totalMatters })}
            </span>
          </DetailField>
          <DetailField label={t("detail.billed_to_date")}>
            <MoneyLines
              amounts={client.stats.billedToDate}
              className="text-[13px] font-bold text-foreground"
            />
          </DetailField>
          <DetailField label={t("detail.outstanding")}>
            <MoneyLines
              amounts={client.stats.outstanding}
              className="text-[13px] font-bold text-danger"
            />
          </DetailField>
          <DetailField label={t("detail.location")}>{client.city ?? "—"}</DetailField>
        </div>
      </CardBody>
    </Card>
  );
}

export function ClientDetailPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation("clients");
  const { can } = usePermissions();
  const navigate = useNavigate();
  const params = useUrlParams<"tab">({ tab: "overview" });
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "")
    ? (params.get("tab") as (typeof TABS)[number])
    : "overview";

  const query = useClient(id);
  const { archive } = useClientMutations(id);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [creatingMatter, setCreatingMatter] = useState(false);
  const canManage = can("update:client");

  useSetPageChrome({
    title: query.data?.name ?? t("title"),
    parent: { label: t("title"), to: "/clients" },
  });

  return (
    <PageContainer>
      <QueryBoundary
        query={query}
        loading={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-10 w-96" />
            <Skeleton className="h-64" />
          </div>
        }
      >
        {(client) => (
          <>
            <ClientHero
              client={client}
              canManage={canManage}
              onEdit={() => setEditing(true)}
              onArchive={() => setArchiving(true)}
              onNewMatter={() => setCreatingMatter(true)}
            />

            <Tabs value={tab} onValueChange={(v) => params.set({ tab: v })}>
              <TabsList>
                {TABS.map((name) => (
                  <TabsTrigger key={name} value={name}>
                    {t(`tabs.${name}`)}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="pt-3.5">
                <div className="grid items-start gap-3.5 lg:grid-cols-[1.25fr_1fr]">
                  <div className="flex flex-col gap-3.5">
                    <OverviewInfo client={client} />
                    <MattersTab id={id} compact />
                  </div>
                  <div className="flex flex-col gap-3.5">
                    <Card>
                      <PanelHeader title={t("detail.billing_summary")} />
                      <CardBody>
                        <BillingSummary client={client} onView={() => params.set({ tab: "billing" })} />
                      </CardBody>
                    </Card>
                    <ActivityTab id={id} compact />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="matters" className="pt-3.5">
                <MattersTab id={id} />
              </TabsContent>
              <TabsContent value="documents" className="pt-3.5">
                <DocumentsTab id={id} count={client.stats.documents} />
              </TabsContent>
              <TabsContent value="communications" className="pt-3.5">
                <CommunicationsTab client={client} canManage={canManage} />
              </TabsContent>
              <TabsContent value="billing" className="pt-3.5">
                <BillingTab id={id} client={client} />
              </TabsContent>
              <TabsContent value="activity" className="pt-3.5">
                <ActivityTab id={id} />
              </TabsContent>
            </Tabs>

            <ClientFormDialog open={editing} onOpenChange={setEditing} client={client} />
            <MatterFormDialog
              open={creatingMatter}
              onOpenChange={setCreatingMatter}
              clientId={client.id}
            />
            <ConfirmDialog
              open={archiving}
              onOpenChange={setArchiving}
              title={t("archive.title", { name: client.name })}
              description={t("archive.body")}
              confirmLabel={t("actions.archive")}
              destructive
              onConfirm={async () => {
                await archive.mutateAsync();
                navigate("/clients");
              }}
            />
          </>
        )}
      </QueryBoundary>
    </PageContainer>
  );
}

function BillingSummary({ client, onView }: { client: Client; onView: () => void }) {
  const { t } = useTranslation("clients");
  const s = client.stats;
  const billed = Number(s.billedToDate[0]?.amount ?? 0);
  const collected = Number(s.collected[0]?.amount ?? 0);
  const pct = billed ? Math.round((collected / billed) * 100) : 0;

  const rows: { label: string; lines: string[]; danger?: boolean }[] = [
    { label: t("detail.billed_to_date"), lines: formatMoneyList(s.billedToDate) },
    { label: t("detail.collected"), lines: formatMoneyList(s.collected) },
    { label: t("detail.outstanding"), lines: formatMoneyList(s.outstanding), danger: true },
  ];

  return (
    <div className="flex flex-col gap-[11px]">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between">
          <span className="text-[12.5px] font-semibold text-secondary">{r.label}</span>
          <span
            className={
              r.danger
                ? "text-[13px] font-extrabold text-danger"
                : "text-[13px] font-extrabold text-foreground"
            }
          >
            {r.lines.length ? r.lines.join(" · ") : "—"}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-secondary">
          {t("detail.unbilled_time")}
        </span>
        <span className="text-[13px] font-extrabold text-foreground">
          {s.unbilledHours} {t("detail.hrs")}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-pill bg-chart-track">
        <div className="h-full rounded-pill bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[11px] font-semibold text-muted">{t("detail.collected_pct", { pct })}</div>
      <button
        type="button"
        onClick={onView}
        className="mt-3.5 flex h-[34px] items-center justify-center rounded-md border border-border-control text-[12.5px] font-bold text-foreground hover:bg-surface-subtle"
      >
        {t("detail.view_invoices")}
      </button>
    </div>
  );
}
