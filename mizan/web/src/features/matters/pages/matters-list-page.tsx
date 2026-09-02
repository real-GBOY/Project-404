import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatDate, formatMoneyList } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Pill, type PillTone } from "@/components/ui/badge";
import { MatterChip } from "@/components/ui/matter-chip";
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
import { useMatterFormOptions, useMatterList } from "../hooks/use-matters";
import { MatterFormDialog } from "../components/matter-form-dialog";
import type { MatterListItem, MatterStatus } from "../types/matter";

const PAGE_SIZE = 10;

const STATUS_TONE: Record<MatterStatus, PillTone> = {
  open: "green",
  on_hold: "amber",
  closed: "gray",
};

export function MattersListPage({ embedded: _embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation("matters");
  const { can } = usePermissions();
  const navigate = useNavigate();
  const options = useMatterFormOptions();
  const params = useUrlParams<"q" | "status" | "practiceArea" | "page" | "view" | "tab">({
    status: "open",
    view: "table",
  });
  const [creating, setCreating] = useState(false);

  const page = params.getNumber("page", 1);
  const view = (params.get("view") ?? "table") as "table" | "grid";
  const query = useMatterList({
    q: params.get("q"),
    status: params.get("status") as never,
    practiceArea: params.get("practiceArea"),
    page,
  });

  const columns = [
    { key: "no", label: t("columns.matter_no"), width: 100 },
    { key: "title", label: t("columns.title_court"), flex: 2.2 },
    { key: "client", label: t("columns.client"), flex: 1.1 },
    { key: "type", label: t("columns.type"), width: 104 },
    { key: "lead", label: t("columns.lead_lawyer"), width: 132 },
    { key: "next", label: t("columns.next_hearing"), width: 112 },
    { key: "status", label: t("columns.status"), width: 108 },
    { key: "menu", label: "", width: 22 },
  ] as const;

  const addBtn = can("create:matter") && (
    <Button size="sm" icon="add" onClick={() => setCreating(true)}>
      {t("actions.add")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <QueryBoundary
        query={query}
        loading={<RowsSkeleton rows={10} />}
        isEmpty={(d) => d.items.length === 0 && !params.get("q") && params.get("status") === "open"}
        empty={<EmptyState icon="gavel" title={t("empty.title")} description={t("empty.body")} action={addBtn || undefined} />}
      >
        {(data) => (
          <>
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
              <StatCard label={t("kpi.total")} value={data.summary.total} />
              <StatCard label={t("kpi.active")} value={data.summary.active} />
              <StatCard label={t("kpi.on_hold")} value={data.summary.onHold} valueTone="warning" />
              <StatCard label={t("kpi.closed_year")} value={data.summary.closedThisYear} />
              <StatCard
                label={t("kpi.aggregate")}
                value={formatMoneyList(data.summary.aggregateValue)}
              />
            </div>

            <ListCard>
              <ListToolbar>
                <ListSearch
                  className="min-w-[290px]"
                  value={params.get("q") ?? ""}
                  placeholder={t("search_placeholder")}
                  onChange={(v) => params.set({ q: v }, { resetPage: true })}
                />
                <div className="ms-auto flex flex-wrap items-center gap-2">
                  <Select
                    value={params.get("status")}
                    onValueChange={(v) => params.set({ status: v }, { resetPage: true })}
                  >
                    <SelectTrigger aria-label={t("columns.status")} className="h-9 w-[8rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">{t("status.open")}</SelectItem>
                      <SelectItem value="on_hold">{t("status.on_hold")}</SelectItem>
                      <SelectItem value="closed">{t("status.closed")}</SelectItem>
                      <SelectItem value="all">{t("common:all")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={params.get("practiceArea") ?? "all"}
                    onValueChange={(v) =>
                      params.set({ practiceArea: v === "all" ? undefined : v }, { resetPage: true })
                    }
                  >
                    <SelectTrigger aria-label={t("columns.practice_area")} className="h-9 w-[10rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("all_areas")}</SelectItem>
                      {(options.data?.practiceAreas ?? []).map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ViewToggle
                    value={view}
                    onChange={(v) => params.set({ view: v })}
                    labels={{
                      table: t("common:table.view_table"),
                      grid: t("common:table.view_grid"),
                    }}
                  />
                  {addBtn}
                </div>
              </ListToolbar>

              {data.items.length === 0 ? (
                <p className="px-[18px] py-12 text-center text-[13px] text-muted">
                  {t("empty.no_results")}
                </p>
              ) : view === "grid" ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-3.5 px-[18px] py-4">
                  {data.items.map((m) => (
                    <MatterGridCard key={m.id} matter={m} onOpen={() => navigate(`/matters/${m.id}`)} />
                  ))}
                </div>
              ) : (
                <>
                  <ColumnHeader columns={[...columns]} />
                  {data.items.map((m) => (
                    <ListRow key={m.id} onClick={() => navigate(`/matters/${m.id}`)}>
                      <Cell col={columns[0]}>
                        <MatterChip>{m.reference}</MatterChip>
                      </Cell>
                      <Cell col={columns[1]}>
                        <div className="truncate text-[13px] font-bold text-foreground">
                          {m.title}
                        </div>
                        <div className="truncate text-[11px] font-medium text-muted">
                          {m.court ?? "—"}
                        </div>
                      </Cell>
                      <Cell col={columns[2]} className="truncate text-[12.5px] text-foreground-body">
                        {m.clientName}
                      </Cell>
                      <Cell col={columns[3]} className="truncate">
                        {m.practiceArea}
                      </Cell>
                      <Cell col={columns[4]} className="truncate">
                        {m.leadLawyer}
                      </Cell>
                      <Cell col={columns[5]} className="font-bold text-foreground">
                        {m.nextHearingAt
                          ? formatDate(m.nextHearingAt, { day: "numeric", month: "short" })
                          : "—"}
                      </Cell>
                      <Cell col={columns[6]}>
                        <Pill tone={STATUS_TONE[m.status]}>{t(`status.${m.status}`)}</Pill>
                      </Cell>
                      <Cell col={columns[7]} className="text-faint">
                        <span className="material-symbols-rounded text-[18px]">more_vert</span>
                      </Cell>
                    </ListRow>
                  ))}
                </>
              )}

              <ListFooter>
                <span className="text-[12px] font-semibold text-muted">
                  {t("showing", {
                    page,
                    pages: Math.max(1, Math.ceil((data.total ?? 0) / PAGE_SIZE)),
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

      <MatterFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function MatterGridCard({ matter, onOpen }: { matter: MatterListItem; onOpen: () => void }) {
  const { t } = useTranslation("matters");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-card border border-border bg-surface p-4 text-start transition-colors hover:border-border-accent hover:bg-surface-warm"
    >
      <div className="mb-2.5 flex items-center gap-2.5">
        <MatterChip>{matter.reference}</MatterChip>
        <Pill tone={STATUS_TONE[matter.status]}>{t(`status.${matter.status}`)}</Pill>
        <span className="ms-auto text-[11px] font-bold text-muted">{matter.practiceArea}</span>
      </div>
      <div className="text-[13.5px] font-bold leading-[1.4] text-foreground">{matter.title}</div>
      <div className="mt-1 text-[11.5px] font-medium text-muted">{matter.court ?? "—"}</div>
      <div className="mt-3.5 grid grid-cols-2 gap-3 border-t border-divider pt-3.5">
        {[
          [t("columns.client"), matter.clientName],
          [t("columns.lead"), matter.leadLawyer],
          [
            t("columns.next_hearing"),
            matter.nextHearingAt
              ? formatDate(matter.nextHearingAt, { day: "numeric", month: "short" })
              : "—",
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="mb-[3px] text-[10px] font-bold uppercase tracking-[0.06em] text-subtle">
              {label}
            </div>
            <div className="truncate text-[12.5px] font-bold text-foreground">{value}</div>
          </div>
        ))}
        <div>
          <div className="mb-[3px] text-[10px] font-bold uppercase tracking-[0.06em] text-subtle">
            {t("columns.value")}
          </div>
          <MoneyLines
            amounts={matter.value}
            className="text-[12.5px] font-bold text-foreground"
          />
        </div>
      </div>
    </button>
  );
}
