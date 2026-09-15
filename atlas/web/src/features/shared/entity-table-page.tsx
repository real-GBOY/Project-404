import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { KpiStrip, KpiTile } from "@/components/ui/kpi-tile";
import { Card } from "@/components/ui/card";
import { ListToolbar, ViewToggle } from "@/components/tables/list-toolbar";
import { FilterDropdown } from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/input";
import { ListFooter } from "@/components/tables/list-pagination";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { QuickCreateModal } from "@/components/tables/quick-create-modal";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useToast } from "@/lib/toast/toast-provider";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { ApiError } from "@/config";
import { useTableConfig } from "./entity-table-registry";
import type { EntityKey } from "./table-types";

const PAGE_SIZE = 12;

/**
 * ONE reusable screen shape — fed a different `TableConfig` per route — is
 * the entire CRM/Sales/Finance/Ops-list/Admin-list section (21 routes,
 * PLAN §3 screen #2). Search and filters are backend-driven: this component
 * only holds the *selected* query/filter state and pagination; the actual
 * narrowing happens in each domain's list endpoint (see table-configs.ts +
 * the corresponding backend repository's `q`/filter columns).
 */
export function EntityTablePage({ entity }: { entity: EntityKey }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"table" | "grid">("table");
  const [createOpen, setCreateOpen] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  // Every keystroke would otherwise fire its own request against the backend.
  const debouncedQuery = useDebouncedValue(query, 300);

  const params = useMemo(
    () => ({
      q: debouncedQuery.trim() || undefined,
      filters: filterValues,
    }),
    [debouncedQuery, filterValues],
  );

  const { config, isLoading, error } = useTableConfig(entity, params);

  const rows = config?.rows ?? [];
  const pageRows = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [rows, page]);
  const hasActiveFilter = Boolean(query) || Object.values(filterValues).some((v) => v && v !== "All");

  if (!config && !isLoading) {
    return (
      <PageContainer>
        <PageHeader title={entity} />
        {error ? (
          <ErrorState
            title="Couldn't load this screen"
            message={error instanceof ApiError ? error.message : "The request failed. Please try again."}
          />
        ) : (
          <EmptyState icon="clock" title="Not wired up yet" description="This entity has no table config registered." />
        )}
      </PageContainer>
    );
  }

  async function handlePrimaryAction() {
    if (config!.createForm) {
      setCreateOpen(true);
      return;
    }
    const ok = await confirm({
      title: config!.primaryAction ?? "Confirm",
      body: `Proceed with ${config!.primaryAction ?? "this action"}?`,
      cta: config!.primaryAction ?? "Confirm",
    });
    if (!ok) return;
    try {
      await config!.onConfirmAction?.();
      toast.push({ kind: "success", title: "Done", body: `${config!.primaryAction} recorded.` });
    } catch (err) {
      toast.push({ kind: "danger", title: "Couldn't complete", body: err instanceof ApiError ? err.message : "Something went wrong." });
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={config?.title ?? entity}
        description={config?.subtitle}
        actions={
          config?.headerExtra ?? (
            <>
              <Button variant="secondary" size="sm" icon="download">
                Export
              </Button>
              {config?.primaryAction && (
                <Button size="sm" icon="plus" onClick={handlePrimaryAction}>
                  {config.primaryAction}
                </Button>
              )}
            </>
          )
        }
      />

      {config?.kpis && (
        <KpiStrip className="mb-3.5">
          {config.kpis.map((k) => (
            <KpiTile key={k.label} {...k} compact />
          ))}
        </KpiStrip>
      )}

      <Card>
        <ListToolbar>
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder={config?.searchPlaceholder ?? "Filter rows…"}
          />
          {config?.filters?.map((f) => (
            <FilterDropdown
              key={f.label}
              label={f.label}
              value={
                f.options.find((o) => o.value === (filterValues[f.param] ?? ""))?.label ?? "All"
              }
              options={["All", ...f.options.map((o) => o.label)]}
              onChange={(label) => {
                const opt = f.options.find((o) => o.label === label);
                setFilterValues((prev) => {
                  const next = { ...prev };
                  if (opt) next[f.param] = opt.value;
                  else delete next[f.param];
                  return next;
                });
                setPage(1);
              }}
            />
          ))}
          <div className="flex-1" />
          <span className="font-mono text-[10.5px] text-subtle">{rows.length} rows</span>
          <ViewToggle value={view} onChange={setView} />
        </ListToolbar>

        <DataTable
          columns={config?.columns ?? []}
          rows={pageRows}
          rowKey={config?.rowKey ?? (() => "")}
          loading={isLoading}
          minWidth={config?.minWidth}
          onRowClick={
            config?.onRowClick
              ? (row) => {
                  const to = config!.onRowClick!(row);
                  if (to) navigate(to);
                }
              : undefined
          }
          emptyTitle={config?.emptyTitle ?? `No ${(config?.title ?? entity).toLowerCase()} match “${query}”`}
          emptyDescription={config?.emptyWhy}
          emptyAction={
            hasActiveFilter ? (
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setFilterValues({});
                  }}
                >
                  Clear filter
                </Button>
                {config?.primaryAction && (
                  <Button size="sm" variant="secondary" onClick={handlePrimaryAction}>
                    {config.primaryAction}
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />

        <ListFooter total={rows.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </Card>

      <QuickCreateModal open={createOpen} onOpenChange={setCreateOpen} config={config?.createForm} />
    </PageContainer>
  );
}
