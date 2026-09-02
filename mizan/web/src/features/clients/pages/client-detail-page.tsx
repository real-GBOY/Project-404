import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatDate } from "@/lib/format";
import { PageContainer } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { MoneyLines } from "@/components/ui/money-lines";
import { Breadcrumb } from "@/components/ui/breadcrumb";
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
import { useClient, useClientMutations } from "../hooks/use-clients";
import { ClientFormDialog } from "../components/client-form-dialog";
import { ClientStatusBadge, ClientTypeBadge } from "../components/client-badges";
import {
  ActivityTab,
  BillingTab,
  CommunicationsTab,
  DocumentsTab,
  MattersTab,
} from "../components/client-tabs";

const TABS = ["overview", "matters", "documents", "communications", "billing", "activity"] as const;

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
  const canManage = can("update:client");

  return (
    <PageContainer>
      <QueryBoundary
        query={query}
        loading={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
          </div>
        }
      >
        {(client) => (
          <>
            <Breadcrumb
              items={[
                { label: t("common:nav.clients"), to: "/clients" },
                { label: client.name },
              ]}
            />

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={client.name} size="lg" />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-[19px] font-extrabold tracking-tight text-foreground">
                      {client.name}
                    </h1>
                    <ClientTypeBadge type={client.type} />
                    <ClientStatusBadge status={client.status} />
                  </div>
                  <p className="text-[12.5px] text-muted">
                    {t("client_since", { date: formatDate(client.createdAt) })}
                  </p>
                </div>
              </div>

              {canManage && (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>
                    {t("common:actions.edit")}
                  </Button>
                  {client.status === "active" && can("archive:client") && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={t("actions.more")}
                        className="flex size-9 items-center justify-center rounded-md border border-border-control text-foreground-body hover:bg-surface-subtle"
                      >
                        <Icon name="more_horiz" size={18} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem icon="archive" destructive onSelect={() => setArchiving(true)}>
                          {t("actions.archive")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
            </div>

            <Tabs value={tab} onValueChange={(v) => params.set({ tab: v })}>
              <TabsList className="overflow-x-auto">
                {TABS.map((name) => (
                  <TabsTrigger key={name} value={name}>
                    {t(`tabs.${name}`)}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview">
                <div className="grid gap-4 md:grid-cols-2">
                  <section className="rounded-lg border border-border bg-surface p-4">
                    <h3 className="mb-3 text-[12px] font-bold uppercase tracking-wide text-subtle">
                      {t("tabs.details")}
                    </h3>
                    <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-[12.5px]">
                      <dt className="text-muted">{t("fields.email")}</dt>
                      <dd className="text-foreground-body">{client.email ?? "—"}</dd>
                      <dt className="text-muted">{t("fields.phone")}</dt>
                      <dd className="text-foreground-body">{client.phone ?? "—"}</dd>
                      <dt className="text-muted">
                        {client.type === "company" ? t("fields.tax_id") : t("fields.national_id")}
                      </dt>
                      <dd className="text-foreground-body">{client.taxId ?? "—"}</dd>
                      <dt className="text-muted">{t("fields.address")}</dt>
                      <dd className="text-foreground-body">{client.address ?? "—"}</dd>
                    </dl>
                    {client.notes && (
                      <p className="mt-3 border-t border-divider pt-3 text-[12.5px] text-foreground-body">
                        {client.notes}
                      </p>
                    )}
                  </section>

                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-border bg-surface p-4">
                        <div className="text-[11.5px] font-semibold text-muted">
                          {t("stats.open_matters")}
                        </div>
                        <div className="text-[20px] font-extrabold text-foreground">
                          {client.stats.openMatters}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border bg-surface p-4">
                        <div className="text-[11.5px] font-semibold text-muted">
                          {t("stats.documents")}
                        </div>
                        <div className="text-[20px] font-extrabold text-foreground">
                          {client.stats.documents}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-surface p-4">
                      <div className="mb-1 text-[11.5px] font-semibold text-muted">
                        {t("stats.outstanding")}
                      </div>
                      <MoneyLines amounts={client.stats.outstanding} className="text-[15px] font-bold" />
                    </div>
                    {client.primaryContact && (
                      <div className="rounded-lg border border-border bg-surface p-4">
                        <div className="mb-2 text-[11.5px] font-semibold text-muted">
                          {t("tabs.key_contact")}
                        </div>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={client.primaryContact.name} size="sm" />
                          <div>
                            <div className="text-[12.5px] font-semibold text-foreground">
                              {client.primaryContact.name}
                            </div>
                            <div className="text-[11.5px] text-muted">
                              {client.primaryContact.role ?? client.primaryContact.email ?? "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="matters">
                <MattersTab id={id} />
              </TabsContent>
              <TabsContent value="documents">
                <DocumentsTab id={id} />
              </TabsContent>
              <TabsContent value="communications">
                <CommunicationsTab client={client} canManage={canManage} />
              </TabsContent>
              <TabsContent value="billing">
                <BillingTab id={id} />
              </TabsContent>
              <TabsContent value="activity">
                <ActivityTab id={id} />
              </TabsContent>
            </Tabs>

            <ClientFormDialog open={editing} onOpenChange={setEditing} client={client} />
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
