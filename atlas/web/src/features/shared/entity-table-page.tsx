import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { KpiStrip, KpiTile } from "@/components/ui/kpi-tile";
import { Card } from "@/components/ui/card";
import { ListToolbar, FilterButton, ViewToggle } from "@/components/tables/list-toolbar";
import { SearchInput } from "@/components/ui/input";
import { ListFooter } from "@/components/tables/list-pagination";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useToast } from "@/lib/toast/toast-provider";
import { getTableConfig } from "./entity-table-registry";
import type { EntityKey } from "./table-types";

const PAGE_SIZE = 12;

/**
 * ONE reusable screen shape — fed a different `TableConfig` per route — is
 * the entire CRM/Sales/Finance/Ops-list/Admin-list section (21 routes,
 * PLAN §3 screen #2). Search/filter/pagination/view-toggle state lives here;
 * data + columns come from the registered config.
 */
export function EntityTablePage({ entity }: { entity: EntityKey }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"table" | "grid">("table");

  const config = getTableConfig(entity);

  const filteredRows = useMemo(() => {
    if (!config) return [];
    const q = query.trim().toLowerCase();
    if (!q) return config.rows;
    return config.rows.filter((r) => config.searchText(r).toLowerCase().includes(q));
  }, [config, query]);

  const pageRows = useMemo(
    () => filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRows, page],
  );

  if (!config) {
    return (
      <PageContainer>
        <PageHeader title={entity} />
        <EmptyState icon="clock" title="Not wired up yet" description="This entity has no table config registered." />
      </PageContainer>
    );
  }

  async function handlePrimaryAction() {
    const ok = await confirm({
      title: config!.primaryAction ?? "Confirm",
      body: `This is a mock action — no backend is connected yet.`,
      cta: config!.primaryAction ?? "Confirm",
    });
    if (ok) toast.push({ kind: "success", title: "Done", body: `${config!.primaryAction} recorded.` });
  }

  return (
    <PageContainer>
      <PageHeader
        title={config.title}
        description={config.subtitle}
        actions={
          config.headerExtra ?? (
            <>
              <Button variant="secondary" size="sm" icon="download">
                Export
              </Button>
              {config.primaryAction && (
                <Button size="sm" icon="plus" onClick={handlePrimaryAction}>
                  {config.primaryAction}
                </Button>
              )}
            </>
          )
        }
      />

      {config.kpis && (
        <KpiStrip className="mb-3.5">
          {config.kpis.map((k) => (
            <KpiTile key={k.label} {...k} compact />
          ))}
        </KpiStrip>
      )}

      <Card>
        <ListToolbar>
          <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder={config.searchPlaceholder ?? "Filter rows…"} />
          {config.filters?.map((f) => (
            <FilterButton key={f} label={f} />
          ))}
          <div className="flex-1" />
          <span className="font-mono text-[10.5px] text-subtle">{filteredRows.length} rows</span>
          <ViewToggle value={view} onChange={setView} />
        </ListToolbar>

        <DataTable
          columns={config.columns}
          rows={pageRows}
          rowKey={config.rowKey}
          minWidth={config.minWidth}
          onRowClick={config.onRowClick ? (row) => {
            const to = config.onRowClick!(row);
            if (to) navigate(to);
          } : undefined}
          emptyTitle={config.emptyTitle ?? `No ${config.title.toLowerCase()} match “${query}”`}
          emptyDescription={config.emptyWhy}
          emptyAction={
            query ? (
              <div className="flex items-center gap-1.5">
                <Button size="sm" onClick={() => setQuery("")}>
                  Clear filter
                </Button>
                {config.primaryAction && (
                  <Button size="sm" variant="secondary" onClick={handlePrimaryAction}>
                    {config.primaryAction}
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />

        <ListFooter total={filteredRows.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </Card>
    </PageContainer>
  );
}
