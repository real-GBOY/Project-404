import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useSetPageChrome } from "@/lib/page-chrome";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatMoneyList } from "@/lib/format";
import { PageContainer } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Pill } from "@/components/ui/badge";
import { MoneyLines } from "@/components/ui/money-lines";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { EmptyState } from "@/components/feedback/empty-state";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import {
  Cell,
  ColumnHeader,
  ListCard,
  ListFooter,
  ListPagination,
  ListRow,
  ListSearch,
  ListToolbar,
  ViewToggle,
} from "@/components/tables/list-card";
import { useClientList } from "../hooks/use-clients";
import { ClientFormDialog } from "../components/client-form-dialog";
import type { ClientListItem } from "../types/client";

const PAGE_SIZE = 10;

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

function statusTone(s: ClientListItem["status"]) {
  return s === "active" ? "green" : "gray";
}

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
  const view = (params.get("view") ?? "table") as "table" | "grid";
  const query = useClientList({
    q: params.get("q"),
    status: params.get("status") as never,
    type: params.get("type") as never,
    sort: params.get("sort"),
    page,
  });

  useSetPageChrome({ title: t("title"), count: query.data?.summary.total ?? null });

  const columns = [
    { key: "client", label: t("columns.client"), flex: 1.6 },
    { key: "contact", label: t("columns.primary_contact"), flex: 1 },
    { key: "matters", label: t("columns.matters"), width: 110 },
    { key: "outstanding", label: t("columns.outstanding"), width: 130 },
    { key: "partner", label: t("columns.partner"), width: 130 },
    { key: "status", label: t("columns.status"), width: 90 },
    { key: "menu", label: "", width: 24 },
  ] as const;

  const addButton = can("create:client") && (
    <Button size="sm" icon="add" onClick={() => setCreating(true)}>
      {t("actions.add")}
    </Button>
  );

  return (
    <PageContainer>
      <QueryBoundary
        query={query}
        loading={<RowsSkeleton rows={10} />}
        isEmpty={(d) => d.items.length === 0 && !params.get("q") && params.get("status") === "active"}
        empty={
          <EmptyState
            icon="apartment"
            title={t("empty.title")}
            description={t("empty.body")}
            action={addButton || undefined}
          />
        }
      >
        {(data) => (
          <>
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
              <StatCard icon="apartment" label={t("kpi.total")} value={data.summary.total} />
              <StatCard icon="domain" label={t("kpi.corporate")} value={data.summary.companies} />
              <StatCard icon="person" label={t("kpi.individuals")} value={data.summary.individuals} />
              <StatCard
                icon="account_balance_wallet"
                label={t("kpi.outstanding")}
                value={
                  data.summary.outstanding.length
                    ? formatMoneyList(data.summary.outstanding)
                    : ["—"]
                }
              />
            </div>

            <ListCard>
              <ListToolbar>
                <ListSearch
                  value={params.get("q") ?? ""}
                  placeholder={t("search_placeholder")}
                  onChange={(v) => params.set({ q: v }, { resetPage: true })}
                />
                <div className="ms-auto flex flex-wrap items-center gap-2">
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
                    onValueChange={(v) =>
                      params.set({ type: v === "all" ? undefined : v }, { resetPage: true })
                    }
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
                  <ViewToggle
                    value={view}
                    onChange={(v) => params.set({ view: v })}
                    labels={{ table: t("common:table.view_table"), grid: t("common:table.view_grid") }}
                  />
                  {addButton}
                </div>
              </ListToolbar>

              {data.items.length === 0 ? (
                <p className="px-[18px] py-12 text-center text-[13px] text-muted">
                  {t("empty.no_results")}
                </p>
              ) : view === "grid" ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-3.5 px-[18px] py-4">
                  {data.items.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => navigate(`/clients/${c.id}`)}
                      className="rounded-card border border-border bg-surface p-4 text-start transition-colors hover:border-border-accent hover:bg-surface-warm"
                    >
                      <div className="flex items-start gap-[11px]">
                        <span className="grid size-10 flex-none place-items-center rounded-panel bg-surface-sand text-[13px] font-extrabold text-link">
                          {initials(c.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-bold leading-[1.35] text-foreground">
                            {c.name}
                          </div>
                          <div className="mt-0.5 text-[11px] font-semibold text-muted">
                            {t(`type.${c.type}`)}
                            {c.city ? ` · ${c.city}` : ""}
                          </div>
                        </div>
                        <Pill tone={statusTone(c.status)}>{t(`status.${c.status}`)}</Pill>
                      </div>
                      <div className="mt-3.5 grid grid-cols-2 gap-3 border-t border-divider pt-3">
                        <div>
                          <div className="mb-[3px] text-[10px] font-bold uppercase tracking-[0.06em] text-subtle">
                            {t("columns.matters")}
                          </div>
                          <div className="text-[12.5px] font-bold text-foreground">
                            <span className="text-[13px] font-extrabold">{c.openMatters}</span>{" "}
                            <span className="text-[11.5px] font-semibold text-muted">
                              {t("open_of", { total: c.totalMatters })}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="mb-[3px] text-[10px] font-bold uppercase tracking-[0.06em] text-subtle">
                            {t("columns.outstanding")}
                          </div>
                          <MoneyLines
                            amounts={c.outstanding}
                            className="text-[12.5px] font-bold text-foreground"
                          />
                        </div>
                        <div>
                          <div className="mb-[3px] text-[10px] font-bold uppercase tracking-[0.06em] text-subtle">
                            {t("columns.primary_contact")}
                          </div>
                          <div className="truncate text-[12.5px] font-bold text-foreground">
                            {c.contactName ?? "—"}
                          </div>
                        </div>
                        <div>
                          <div className="mb-[3px] text-[10px] font-bold uppercase tracking-[0.06em] text-subtle">
                            {t("columns.partner")}
                          </div>
                          <div className="truncate text-[12.5px] font-bold text-foreground">
                            {c.partner ?? "—"}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <ColumnHeader columns={[...columns]} />
                  {data.items.map((c) => (
                    <ListRow key={c.id} onClick={() => navigate(`/clients/${c.id}`)}>
                      <Cell col={columns[0]} className="flex items-center gap-[11px]">
                        <span className="grid size-[34px] flex-none place-items-center rounded-btn bg-surface-sand text-[12px] font-extrabold text-link">
                          {initials(c.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-[13.5px] font-bold text-foreground">
                            {c.name}
                          </div>
                          <div className="text-[11px] font-semibold text-muted">
                            {t(`type.${c.type}`)}
                            {c.city ? ` · ${c.city}` : ""}
                          </div>
                        </div>
                      </Cell>
                      <Cell col={columns[1]}>
                        <div className="truncate text-[12.5px] font-bold text-foreground">
                          {c.contactName ?? "—"}
                        </div>
                        <div className="truncate text-[11px] font-medium text-muted">
                          {c.email ?? c.phone ?? "—"}
                        </div>
                      </Cell>
                      <Cell col={columns[2]} className="flex items-baseline gap-1.5 whitespace-nowrap">
                        <span className="text-[13px] font-extrabold text-foreground">
                          {c.openMatters}
                        </span>
                        <span className="text-[11.5px] font-semibold text-muted">
                          {t("open_of", { total: c.totalMatters })}
                        </span>
                      </Cell>
                      <Cell col={columns[3]}>
                        <MoneyLines
                          amounts={c.outstanding}
                          className="text-[12.5px] font-bold text-foreground"
                        />
                      </Cell>
                      <Cell col={columns[4]} className="truncate">
                        {c.partner ?? "—"}
                      </Cell>
                      <Cell col={columns[5]}>
                        <Pill tone={statusTone(c.status)}>{t(`status.${c.status}`)}</Pill>
                      </Cell>
                      <Cell col={columns[6]} className="text-end text-faint">
                        <span className="material-symbols-rounded text-[18px]">more_vert</span>
                      </Cell>
                    </ListRow>
                  ))}
                </>
              )}

              <ListFooter>
                <span className="text-[12px] font-semibold text-muted">
                  {t("showing", {
                    from: (page - 1) * PAGE_SIZE + 1,
                    to: Math.min(page * PAGE_SIZE, data.total ?? data.items.length),
                    total: data.total ?? data.items.length,
                  })}
                </span>
                <ListPagination
                  page={page}
                  pageCount={Math.ceil((data.total ?? 0) / PAGE_SIZE)}
                  onPageChange={(p) => params.set({ page: p })}
                />
              </ListFooter>
            </ListCard>
          </>
        )}
      </QueryBoundary>

      <ClientFormDialog open={creating} onOpenChange={setCreating} />
    </PageContainer>
  );
}
