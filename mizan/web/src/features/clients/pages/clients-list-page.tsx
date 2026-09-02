import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatDate } from "@/lib/format";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { MoneyLines } from "@/components/ui/money-lines";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { EmptyState } from "@/components/feedback/empty-state";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { DataTable, type Column } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { ListToolbar } from "@/components/tables/list-toolbar";
import { useClientList } from "../hooks/use-clients";
import { ClientFormDialog } from "../components/client-form-dialog";
import { ClientStatusBadge, ClientTypeBadge } from "../components/client-badges";
import type { ClientListItem } from "../types/client";

const PAGE_SIZE = 10;

export function ClientsListPage() {
  const { t } = useTranslation("clients");
  const { can } = usePermissions();
  const navigate = useNavigate();
  const params = useUrlParams<"q" | "status" | "type" | "sort" | "page" | "view">({
    status: "active",
    view: "table",
  });
  const [creating, setCreating] = useState(false);

  const page = params.getNumber("page", 1);
  const view = params.get("view") as "table" | "grid";
  const query = useClientList({
    q: params.get("q"),
    status: params.get("status") as never,
    type: params.get("type") as never,
    sort: params.get("sort"),
    page,
  });

  const columns: Column<ClientListItem>[] = [
    {
      id: "name",
      header: t("columns.name"),
      cell: (c) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={c.name} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-semibold text-foreground">{c.name}</span>
              <ClientStatusBadge status={c.status} />
            </div>
            <span className="text-[11.5px] text-muted">{c.email ?? c.phone ?? "—"}</span>
          </div>
        </div>
      ),
      sortable: true,
    },
    { id: "type", header: t("columns.type"), cell: (c) => <ClientTypeBadge type={c.type} />, hideBelow: "sm" },
    {
      id: "openMatters",
      header: t("columns.open_matters"),
      cell: (c) => <span className="tabular-nums">{c.openMatters}</span>,
      align: "center",
      hideBelow: "md",
    },
    {
      id: "outstanding",
      header: t("columns.outstanding"),
      cell: (c) => <MoneyLines amounts={c.outstanding} align="end" className="text-[12px]" />,
      align: "end",
    },
    {
      id: "createdAt",
      header: t("columns.client_since"),
      cell: (c) => <span className="text-[12px] text-muted">{formatDate(c.createdAt)}</span>,
      align: "end",
      hideBelow: "lg",
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          can("create:client") ? (
            <Button icon="add" onClick={() => setCreating(true)}>
              {t("actions.new")}
            </Button>
          ) : undefined
        }
      />

      <ListToolbar
        search={{
          value: params.get("q") ?? "",
          onChange: (v) => params.set({ q: v }, { resetPage: true }),
          placeholder: t("search_placeholder"),
        }}
        view={{ value: view, onChange: (v) => params.set({ view: v }) }}
        filters={
          <>
            <Select
              value={params.get("status")}
              onValueChange={(v) => params.set({ status: v }, { resetPage: true })}
            >
              <SelectTrigger aria-label={t("columns.status")} className="h-9 w-[8.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("status.active")}</SelectItem>
                <SelectItem value="archived">{t("status.archived")}</SelectItem>
                <SelectItem value="all">{t("common:all")}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={params.get("type") ?? "all"}
              onValueChange={(v) => params.set({ type: v === "all" ? undefined : v }, { resetPage: true })}
            >
              <SelectTrigger aria-label={t("columns.type")} className="h-9 w-[8.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("type.all")}</SelectItem>
                <SelectItem value="company">{t("type.company")}</SelectItem>
                <SelectItem value="individual">{t("type.individual")}</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <QueryBoundary
        query={query}
        loading={<RowsSkeleton rows={8} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon="groups"
            title={params.get("q") ? t("empty.no_results") : t("empty.title")}
            description={params.get("q") ? t("empty.no_results_body") : t("empty.body")}
            action={
              can("create:client") && !params.get("q") ? (
                <Button icon="add" onClick={() => setCreating(true)}>
                  {t("actions.new")}
                </Button>
              ) : undefined
            }
          />
        }
      >
        {(data) => (
          <div className="flex flex-col gap-4">
            {view === "grid" ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((c) => (
                  <Card
                    key={c.id}
                    className="cursor-pointer p-4 transition-colors hover:border-border-accent"
                    onClick={() => navigate(`/clients/${c.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} size="md" />
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-bold text-foreground">{c.name}</div>
                        <div className="text-[11.5px] text-muted">{c.email ?? c.phone ?? "—"}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-divider pt-3 text-[12px]">
                      <span className="text-muted">
                        {t("columns.open_matters")}: <span className="font-semibold text-foreground">{c.openMatters}</span>
                      </span>
                      <MoneyLines amounts={c.outstanding} align="end" className="text-[11.5px]" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <DataTable
                columns={columns}
                rows={data.items}
                rowKey={(c) => c.id}
                onRowClick={(c) => navigate(`/clients/${c.id}`)}
                sort={
                  params.get("sort")
                    ? { column: "name", direction: params.get("sort") === "createdAt" ? "asc" : "desc" }
                    : undefined
                }
              />
            )}
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted">
                {t("common:table.of_total", {
                  from: (page - 1) * PAGE_SIZE + 1,
                  to: Math.min(page * PAGE_SIZE, data.total ?? data.items.length),
                  total: data.total ?? data.items.length,
                })}
              </span>
              <Pagination
                page={page}
                pageCount={Math.ceil((data.total ?? 0) / PAGE_SIZE)}
                onPageChange={(p) => params.set({ page: p })}
              />
            </div>
          </div>
        )}
      </QueryBoundary>

      <ClientFormDialog open={creating} onOpenChange={setCreating} />
    </PageContainer>
  );
}
