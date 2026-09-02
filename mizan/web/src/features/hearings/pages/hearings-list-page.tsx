import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUrlParams } from "@/hooks/use-url-params";
import { httpClient } from "@/lib/api/http-client";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Pill, type PillTone } from "@/components/ui/badge";
import { MatterChip } from "@/components/ui/matter-chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { EmptyState } from "@/components/feedback/empty-state";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import {
  Cell,
  ColumnHeader,
  ListCard,
  ListRow,
  ListSearch,
  ListToolbar,
  ToolbarButton,
  ViewToggle,
} from "@/components/tables/list-card";
import { useHearingList } from "../hooks/use-hearings";
import { AdjournDialog, OutcomeDialog, ScheduleHearingDialog } from "../components/hearing-dialogs";
import type { HearingRow, HearingsSummary, HearingStatus } from "../api/hearings.api";

const TONE: Record<HearingStatus, PillTone> = {
  scheduled: "green",
  adjourned: "gray",
  decided: "blue",
};

export function HearingsListPage({ embedded: _embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation("hearings");
  const { can } = usePermissions();
  const navigate = useNavigate();
  const params = useUrlParams<"scope" | "q" | "view">({ scope: "upcoming", view: "table" });
  const scope = (params.get("scope") as "upcoming" | "past") ?? "upcoming";
  const view = (params.get("view") ?? "table") as "table" | "grid";
  const query = useHearingList({ scope });
  const q = (params.get("q") ?? "").toLowerCase();

  const summary = useQuery({
    queryKey: ["hearings", "summary"],
    queryFn: ({ signal }) => httpClient<HearingsSummary>("/hearings/summary", { signal }),
  });

  const [scheduling, setScheduling] = useState(false);
  const [adjourning, setAdjourning] = useState<HearingRow | null>(null);
  const [recording, setRecording] = useState<HearingRow | null>(null);
  const canManage = can("update:hearing");

  const columns = [
    { key: "date", label: t("columns.date"), width: 120 },
    { key: "time", label: t("columns.time"), width: 64 },
    { key: "matter", label: t("columns.matter"), width: 96 },
    { key: "case", label: t("columns.case"), flex: 1.2 },
    { key: "court", label: t("columns.court"), flex: 1 },
    { key: "type", label: t("columns.type"), width: 120 },
    { key: "attending", label: t("columns.attending"), width: 130 },
    { key: "status", label: t("columns.status"), width: 120 },
  ] as const;

  const s = summary.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label={t("kpi.scheduled")} value={s?.scheduled ?? "—"} />
        <StatCard label={t("kpi.next7")} value={s?.next7 ?? "—"} valueTone="brand" />
        <StatCard label={t("kpi.awaiting")} value={s?.awaitingDate ?? "—"} valueTone="warning" />
        <StatCard label={t("kpi.adjourned_q")} value={s?.adjournedQuarter ?? "—"} />
      </div>

      <ListCard>
        <ListToolbar>
          <SegmentedControl
            aria-label={t("scope.label")}
            size="sm"
            value={scope}
            onValueChange={(v) => params.set({ scope: v === "upcoming" ? undefined : v })}
            options={[
              { value: "upcoming", label: t("scope.upcoming") },
              { value: "past", label: t("scope.past") },
            ]}
          />
          <ListSearch
            className="min-w-[240px]"
            value={params.get("q") ?? ""}
            placeholder={t("search_placeholder")}
            onChange={(v) => params.set({ q: v })}
          />
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <ToolbarButton icon="filter_list">{t("filter")}</ToolbarButton>
            <ViewToggle
              value={view}
              onChange={(v) => params.set({ view: v })}
              labels={{ table: t("common:table.view_table"), grid: t("common:table.view_grid") }}
            />
            <ToolbarButton icon="calendar_month" onClick={() => navigate("/calendar")}>
              {t("calendar_view")}
            </ToolbarButton>
            {can("create:hearing") && (
              <Button size="sm" icon="add" onClick={() => setScheduling(true)}>
                {t("actions.schedule")}
              </Button>
            )}
          </div>
        </ListToolbar>

        <QueryBoundary
          query={query}
          loading={<RowsSkeleton rows={6} />}
          isEmpty={(d) => d.items.length === 0}
          empty={
            <EmptyState
              icon="balance"
              title={scope === "upcoming" ? t("empty.upcoming") : t("empty.past")}
            />
          }
        >
          {(data) => {
            const rows = q
              ? data.items.filter((h) =>
                  `${h.matterTitle} ${h.court} ${h.leadLawyer}`.toLowerCase().includes(q),
                )
              : data.items;

            if (view === "grid") {
              return (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5 px-[18px] py-4">
                  {rows.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => navigate(`/matters/${h.matterId}?tab=hearings`)}
                      className="rounded-card border border-border bg-surface p-4 text-start transition-colors hover:border-border-accent hover:bg-surface-warm"
                    >
                      <div className="flex items-center gap-[11px]">
                        <div className="rounded-group bg-surface-sand px-3 py-2 text-center">
                          <div className="text-[14px] font-extrabold leading-[1.1] text-primary-deepest">
                            {formatDate(h.scheduledAt, { day: "numeric", month: "short" })}
                          </div>
                          <div className="text-[10.5px] font-bold text-link">
                            {formatDate(h.scheduledAt, { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-bold leading-[1.35] text-foreground">
                            {h.matterTitle}
                          </div>
                          <div className="mt-0.5 text-[11px] font-medium text-muted">{h.court}</div>
                        </div>
                      </div>
                      <div className="mt-3.5 flex flex-wrap items-center gap-2.5 border-t border-divider pt-3">
                        <MatterChip>{h.matterReference}</MatterChip>
                        <span className="text-[11.5px] font-semibold text-secondary">
                          {h.purpose} · {h.leadLawyer}
                        </span>
                        <span className="ms-auto">
                          <Pill tone={TONE[h.status]}>{t(`status.${h.status}`)}</Pill>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              );
            }

            return (
              <>
                <ColumnHeader columns={[...columns]} />
                {rows.map((h) => (
                  <ListRow
                    key={h.id}
                    onClick={() => navigate(`/matters/${h.matterId}?tab=hearings`)}
                  >
                    <Cell col={columns[0]} className="text-[12.5px] font-extrabold text-foreground">
                      {formatDate(h.scheduledAt, { day: "numeric", month: "short", year: "numeric" })}
                    </Cell>
                    <Cell col={columns[1]}>
                      {formatDate(h.scheduledAt, { hour: "2-digit", minute: "2-digit" })}
                    </Cell>
                    <Cell col={columns[2]}>
                      <MatterChip>{h.matterReference}</MatterChip>
                    </Cell>
                    <Cell col={columns[3]}>
                      <div className="truncate text-[13px] font-bold text-foreground">
                        {h.matterTitle}
                      </div>
                      {h.outcome && (
                        <div className="truncate text-[11px] font-medium text-muted">
                          “{h.outcome}”
                        </div>
                      )}
                    </Cell>
                    <Cell col={columns[4]} className="truncate text-[12px] font-medium text-muted">
                      {h.court}
                    </Cell>
                    <Cell col={columns[5]} className="truncate">
                      {h.purpose}
                    </Cell>
                    <Cell col={columns[6]} className="truncate">
                      {h.leadLawyer}
                    </Cell>
                    <Cell col={columns[7]} className="flex items-center gap-1">
                      <Pill tone={TONE[h.status]}>{t(`status.${h.status}`)}</Pill>
                      {canManage && h.status === "scheduled" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={t("common:actions.edit")}
                            onClick={(e) => e.stopPropagation()}
                            className="flex size-6 items-center justify-center rounded text-faint hover:bg-surface-subtle"
                          >
                            <Icon name="more_vert" size={16} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem icon="event_repeat" onSelect={() => setAdjourning(h)}>
                              {t("actions.adjourn")}
                            </DropdownMenuItem>
                            <DropdownMenuItem icon="gavel" onSelect={() => setRecording(h)}>
                              {t("actions.record_outcome")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </Cell>
                  </ListRow>
                ))}
              </>
            );
          }}
        </QueryBoundary>
      </ListCard>

      <ScheduleHearingDialog open={scheduling} onOpenChange={setScheduling} />
      <AdjournDialog hearing={adjourning} onOpenChange={(o) => !o && setAdjourning(null)} />
      <OutcomeDialog hearing={recording} onOpenChange={(o) => !o && setRecording(null)} />
    </div>
  );
}
