import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatDate } from "@/lib/format";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { EmptyState } from "@/components/feedback/empty-state";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { DataTable, type Column } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { ListToolbar } from "@/components/tables/list-toolbar";
import { useMatterFormOptions, useMatterList } from "../hooks/use-matters";
import { MatterFormDialog } from "../components/matter-form-dialog";
import { MatterStatusBadge } from "../components/matter-badges";
import type { MatterListItem } from "../types/matter";

const PAGE_SIZE = 10;

export function MattersListPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation("matters");
  const { can } = usePermissions();
  const navigate = useNavigate();
  const options = useMatterFormOptions();
  const params = useUrlParams<"q" | "status" | "practiceArea" | "page" | "tab">({ status: "open" });
  const [creating, setCreating] = useState(false);

  const page = params.getNumber("page", 1);
  const query = useMatterList({
    q: params.get("q"),
    status: params.get("status") as never,
    practiceArea: params.get("practiceArea"),
    page,
  });

  const columns: Column<MatterListItem>[] = [
    {
      id: "title",
      header: t("columns.matter"),
      cell: (m) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-foreground">{m.title}</span>
            <MatterStatusBadge status={m.status} />
          </div>
          <span className="text-[11.5px] text-muted">
            {m.reference} · {m.clientName}
          </span>
        </div>
      ),
    },
    { id: "practiceArea", header: t("columns.practice_area"), cell: (m) => m.practiceArea, hideBelow: "md" },
    { id: "leadLawyer", header: t("columns.lead"), cell: (m) => m.leadLawyer, hideBelow: "lg" },
    {
      id: "nextHearingAt",
      header: t("columns.next_hearing"),
      cell: (m) =>
        m.nextHearingAt ? (
          <span className="text-[12px]">{formatDate(m.nextHearingAt)}</span>
        ) : (
          <span className="text-[12px] text-muted">—</span>
        ),
      hideBelow: "sm",
      align: "end",
    },
    {
      id: "openTasks",
      header: t("columns.tasks"),
      cell: (m) => <span className="tabular-nums">{m.openTasks}</span>,
      align: "center",
      hideBelow: "md",
    },
  ];

  const content = (
    <>
      <ListToolbar
        search={{
          value: params.get("q") ?? "",
          onChange: (v) => params.set({ q: v }, { resetPage: true }),
          placeholder: t("search_placeholder"),
        }}
        filters={
          <>
            <Select value={params.get("status")} onValueChange={(v) => params.set({ status: v }, { resetPage: true })}>
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
              onValueChange={(v) => params.set({ practiceArea: v === "all" ? undefined : v }, { resetPage: true })}
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
          </>
        }
      />

      <QueryBoundary
        query={query}
        loading={<RowsSkeleton rows={8} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon="gavel"
            title={params.get("q") ? t("empty.no_results") : t("empty.title")}
            description={params.get("q") ? t("empty.no_results_body") : t("empty.body")}
            action={
              can("create:matter") && !params.get("q") ? (
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
            <DataTable
              columns={columns}
              rows={data.items}
              rowKey={(m) => m.id}
              onRowClick={(m) => navigate(`/matters/${m.id}`)}
            />
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted">
                {t("common:table.of_total", {
                  from: (page - 1) * PAGE_SIZE + 1,
                  to: Math.min(page * PAGE_SIZE, data.total ?? 0),
                  total: data.total ?? 0,
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
      <MatterFormDialog open={creating} onOpenChange={setCreating} />
    </>
  );

  if (embedded) return <div className="flex flex-col gap-4">{content}</div>;

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          can("create:matter") ? (
            <Button icon="add" onClick={() => setCreating(true)}>
              {t("actions.new")}
            </Button>
          ) : undefined
        }
      />
      {content}
    </PageContainer>
  );
}
