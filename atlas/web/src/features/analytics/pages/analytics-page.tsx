import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { KpiStrip, KpiTile } from "@/components/ui/kpi-tile";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ErrorState } from "@/components/feedback/error-state";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { DualBarChart } from "@/components/charts/bar-chart";
import { LineChart, StatFooter } from "@/components/charts/line-chart";
import { formatEgp, toNumber } from "@/lib/money";
import { downloadCsv } from "@/lib/csv-export";
import { useToast } from "@/lib/toast/toast-provider";
import { ApiError } from "@/config";
import { useDashboardSummary } from "@/api/dashboard";
import { useLeads } from "@/api/crm";

type AnalyticsRoute = "an_sales" | "an_leads" | "an_project" | "an_revenue" | "an_inventory";

const ROUTE_COPY: Record<AnalyticsRoute, { title: string; subtitle: string; bars: string; line: string; breakdown: string }> = {
  an_sales: { title: "Sales Analytics", subtitle: "Revenue, deal size and win rate across the portfolio", bars: "Due vs. Collected by Project", line: "Sales Velocity by Project", breakdown: "Sales by Project" },
  an_leads: { title: "Lead Analytics", subtitle: "Funnel volume and conversion across the portfolio", bars: "Due vs. Collected by Project", line: "Sales Velocity by Project", breakdown: "Leads Context by Project" },
  an_project: { title: "Project Analytics", subtitle: "Portfolio composition by project", bars: "Due vs. Collected by Project", line: "Sales Velocity by Project", breakdown: "Project Breakdown" },
  an_revenue: { title: "Revenue Analytics", subtitle: "Revenue, collections and overdue exposure", bars: "Due vs. Collected by Project", line: "Collection Rate by Project", breakdown: "Revenue by Project" },
  an_inventory: { title: "Inventory Analytics", subtitle: "Unit status mix across the portfolio", bars: "Due vs. Collected by Project", line: "Sales Velocity by Project", breakdown: "Inventory by Project" },
};

export function AnalyticsPage({ route }: { route: AnalyticsRoute }) {
  const navigate = useNavigate();
  const toast = useToast();
  const summary = useDashboardSummary();
  const leads = useLeads();
  const copy = ROUTE_COPY[route];
  const [projectFilter, setProjectFilter] = useState<string>("all");

  if (summary.isLoading || leads.isLoading) {
    return (
      <PageContainer>
        <PageHeader title={copy.title} description={copy.subtitle} />
        <RowsSkeleton rows={8} cols={4} />
      </PageContainer>
    );
  }

  const error = summary.error ?? leads.error;
  if (error || !summary.data) {
    return (
      <PageContainer>
        <PageHeader title={copy.title} description={copy.subtitle} />
        <ErrorState title="Couldn't load analytics" message={error instanceof ApiError ? error.message : "The request failed."} />
      </PageContainer>
    );
  }

  const d = summary.data;
  const projectName = new Map(d.projects.map((p) => [p.id, p.name]));
  const avgSellThrough = d.projects.length ? d.projects.reduce((s, p) => s + toNumber(p.sellThroughPct), 0) / d.projects.length : 0;
  const soldLeads = (leads.data ?? []).filter((l) => l.stage === "sold");
  const qualifiedLeads = (leads.data ?? []).filter((l) => l.stage !== "new" && l.stage !== "lost");

  const kpis: Record<AnalyticsRoute, { label: string; value: string }[]> = {
    an_sales: [
      { label: "Total Revenue", value: formatEgp(d.revenueEgp) },
      { label: "Units Sold", value: d.soldUnits.toLocaleString() },
      { label: "Avg Deal Size", value: soldLeads.length ? formatEgp(soldLeads.reduce((s, l) => s + l.valueEgp, 0) / soldLeads.length) : "EGP 0" },
      { label: "Avg Sell-through", value: `${avgSellThrough.toFixed(1)}%` },
    ],
    an_leads: [
      { label: "Total Leads", value: String((leads.data ?? []).length) },
      { label: "Qualified", value: String(qualifiedLeads.length) },
      { label: "Conversion Rate", value: (leads.data ?? []).length ? `${((soldLeads.length / (leads.data ?? []).length) * 100).toFixed(1)}%` : "0%" },
      { label: "Avg Score", value: (leads.data ?? []).length ? ((leads.data ?? []).reduce((s, l) => s + l.score, 0) / (leads.data ?? []).length).toFixed(0) : "0" },
    ],
    an_project: [
      { label: "Projects", value: String(d.projectCount) },
      { label: "Total Units", value: d.totalUnits.toLocaleString() },
      { label: "Available", value: d.availableUnits.toLocaleString() },
      { label: "Avg Sell-through", value: `${avgSellThrough.toFixed(1)}%` },
    ],
    an_revenue: [
      { label: "Total Revenue", value: formatEgp(d.revenueEgp) },
      { label: "Collected", value: formatEgp(d.collectionsByProject.reduce((s, c) => s + c.collectedEgp, 0)) },
      { label: "Overdue", value: formatEgp(d.collectionsByProject.reduce((s, c) => s + c.overdueEgp, 0)) },
      { label: "Portfolio Value", value: formatEgp(d.totalValueEgp) },
    ],
    an_inventory: [
      { label: "Total Units", value: d.totalUnits.toLocaleString() },
      { label: "Sold", value: d.soldUnits.toLocaleString() },
      { label: "Reserved", value: d.reservedUnits.toLocaleString() },
      { label: "Available", value: d.availableUnits.toLocaleString() },
    ],
  };

  // "Project: All" filter narrows the by-project chart/breakdown to one
  // project — the headline KPI strip above stays portfolio-wide (there's no
  // project dimension on the lead-based KPIs to filter consistently).
  const filteredProjects = projectFilter === "all" ? d.projects : d.projects.filter((p) => p.id === projectFilter);
  const filteredCollections = projectFilter === "all" ? d.collectionsByProject : d.collectionsByProject.filter((c) => c.projectId === projectFilter);

  const collectionsMax = Math.max(...filteredCollections.map((c) => c.dueEgp), 1);
  const bars = filteredCollections.map((c) => ({
    label: (projectName.get(c.projectId) ?? c.projectId).slice(0, 8),
    top: formatEgp(c.dueEgp),
    a: Math.round((c.dueEgp / collectionsMax) * 100),
    b: Math.round((c.collectedEgp / collectionsMax) * 100),
  }));

  const lineSeries =
    route === "an_revenue"
      ? filteredCollections.map((c) => ({ label: (projectName.get(c.projectId) ?? c.projectId).slice(0, 3), value: c.collectionRatePct }))
      : filteredProjects.map((p) => ({ label: p.name.slice(0, 3), value: toNumber(p.velocityPerWeek) }));
  const latest = lineSeries.length ? lineSeries[lineSeries.length - 1].value : 0;
  const first = lineSeries.length ? lineSeries[0].value : 0;
  const change = first !== 0 ? (((latest - first) / first) * 100).toFixed(1) : "0.0";

  return (
    <PageContainer>
      <PageHeader
        title={copy.title}
        description={copy.subtitle}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            onClick={() => {
              downloadCsv(
                `${route}-${new Date().toISOString().slice(0, 10)}.csv`,
                filteredProjects.map((p) => ({
                  project: p.name,
                  soldUnits: p.soldUnits,
                  totalUnits: p.totalUnits,
                  revenueEgp: p.revenueEgp,
                  velocityPerWeek: p.velocityPerWeek,
                  sellThroughPct: p.sellThroughPct,
                })),
              );
              toast.push({ kind: "success", title: "Exported", body: `${copy.breakdown} downloaded as CSV.` });
            }}
          >
            Export
          </Button>
        }
        below={
          <div className="flex flex-wrap gap-1.5">
            <Chip activeVariant="pale" active={projectFilter === "all"} onClick={() => setProjectFilter("all")}>
              Project: All
            </Chip>
            {d.projects.map((p) => (
              <Chip key={p.id} activeVariant="pale" active={projectFilter === p.id} onClick={() => setProjectFilter(p.id)}>
                {p.name}
              </Chip>
            ))}
          </div>
        }
      />

      <KpiStrip className="mb-3.5">
        {kpis[route].map((k) => (
          <KpiTile key={k.label} label={k.label} value={k.value} compact />
        ))}
      </KpiStrip>

      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title={copy.bars} />
          {bars.length > 0 ? <DualBarChart data={bars} height={150} /> : <EmptyChart />}
        </Card>
        <Card>
          <CardHeader title={copy.line} />
          {lineSeries.length > 0 ? (
            <>
              <div className="px-3 pt-3">
                <LineChart data={lineSeries} height={80} />
              </div>
              <StatFooter items={[{ label: "Latest", value: latest.toFixed(1) }, { label: "vs. first project", value: `${change}%`, valueClassName: Number(change) >= 0 ? "text-success" : "text-danger" }]} />
            </>
          ) : (
            <EmptyChart />
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title={copy.breakdown} />
        <div className="grid grid-cols-[1.6fr_.8fr_.8fr_1.2fr] gap-2 border-b border-border-row bg-surface-subtle px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
          <div>Project</div>
          <div className="text-end">Units sold</div>
          <div className="text-end">Revenue</div>
          <div>Sell-through</div>
        </div>
        {filteredProjects.map((p) => {
          const sellThrough = toNumber(p.sellThroughPct);
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/projects/${p.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/projects/${p.id}`);
                }
              }}
              className="grid cursor-pointer grid-cols-[1.6fr_.8fr_.8fr_1.2fr] items-center gap-2 border-b border-border-row px-3 py-2 last:border-0 hover:bg-surface-hover"
            >
              <div className="truncate text-[11.5px] font-medium">{p.name}</div>
              <div className="text-end font-mono text-[11px]">{p.soldUnits}</div>
              <div className="text-end font-mono text-[11px]">{formatEgp(p.revenueEgp)}</div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 flex-1 bg-surface-track">
                  <div className="h-full bg-primary" style={{ width: `${sellThrough}%` }} />
                </div>
                <span className="w-8 flex-none font-mono text-[10px] text-secondary">{sellThrough.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </Card>
    </PageContainer>
  );
}

function EmptyChart() {
  return <div className="flex h-[140px] items-center justify-center text-[11px] text-subtle">No data yet.</div>;
}
