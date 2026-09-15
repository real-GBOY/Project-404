import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { KpiStrip, KpiTile } from "@/components/ui/kpi-tile";
import { Card, CardHeader, CardLink } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Icon } from "@/components/ui/icon";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { InsightCard } from "@/components/domain/insight-card";
import { DualBarChart, ChartLegend } from "@/components/charts/bar-chart";
import { LineChart, StatFooter } from "@/components/charts/line-chart";
import { Funnel, StackedBarLegend } from "@/components/charts/funnel";
import { useToast } from "@/lib/toast/toast-provider";
import { toneOf } from "@/lib/tone";
import { formatEgp, toNumber } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { titleCase } from "@/lib/text";
import { useTeamDirectory } from "@/api/team";
import { useDashboardSummary, useInsights, useDismissInsight } from "@/api/dashboard";
import { ApiError } from "@/lib/api/client";

const RANGES = [
  { value: "mtd", label: "MTD" },
  { value: "qtd", label: "QTD" },
  { value: "ytd", label: "YTD" },
  { value: "12m", label: "12M" },
] as const;

const UNIT_TYPE_COLORS = [
  "var(--color-chart-primary)",
  "var(--color-chart-secondary)",
  "var(--color-chart-tertiary, var(--color-success))",
  "var(--color-warning)",
  "var(--color-danger)",
];

export function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("mtd");

  const summary = useDashboardSummary();
  const insights = useInsights("dashboard");
  const team = useTeamDirectory();
  const dismissInsight = useDismissInsight();

  if (summary.isLoading || insights.isLoading || team.isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Executive Dashboard" />
        <Card>
          <RowsSkeleton rows={10} cols={4} />
        </Card>
      </PageContainer>
    );
  }

  if (summary.error) {
    return (
      <PageContainer>
        <PageHeader title="Executive Dashboard" />
        <ErrorState title="Couldn't load the dashboard" message={summary.error instanceof ApiError ? summary.error.message : "The request failed."} />
      </PageContainer>
    );
  }

  const d = summary.data!;
  const avgSellThrough = d.projects.length ? d.projects.reduce((s, p) => s + toNumber(p.sellThroughPct), 0) / d.projects.length : 0;

  const inventoryTotals = new Map<string, { available: number; reserved: number; sold: number }>();
  for (const row of d.inventoryByType) {
    const cur = inventoryTotals.get(row.unitType) ?? { available: 0, reserved: 0, sold: 0 };
    inventoryTotals.set(row.unitType, {
      available: cur.available + row.available,
      reserved: cur.reserved + row.reserved,
      sold: cur.sold + row.sold,
    });
  }
  const inventoryTotal = [...inventoryTotals.values()].reduce((s, v) => s + v.available + v.reserved + v.sold, 0);
  const inventorySegments = [...inventoryTotals.entries()].map(([label, v], i) => {
    const n = v.available + v.reserved + v.sold;
    return { label, n, pct: inventoryTotal > 0 ? Math.round((n / inventoryTotal) * 100) : 0, color: UNIT_TYPE_COLORS[i % UNIT_TYPE_COLORS.length] };
  });

  const projectName = new Map(d.projects.map((p) => [p.id, p.name]));
  const funnelMax = Math.max(...d.leadFunnel.map((f) => f.count), 1);
  const funnelStages = d.leadFunnel.map((f) => ({
    label: titleCase(f.stage),
    n: f.count,
    rate: funnelMax > 0 ? `${Math.round((f.count / funnelMax) * 100)}%` : "0%",
    pct: Math.round((f.count / funnelMax) * 100),
    color: "var(--color-chart-primary)",
  }));

  const collectionsMax = Math.max(...d.collectionsByProject.map((c) => c.dueEgp), 1);
  const collectionBars = d.collectionsByProject.map((c) => ({
    label: (projectName.get(c.projectId) ?? c.projectId).slice(0, 8),
    top: formatEgp(c.dueEgp),
    a: Math.round((c.dueEgp / collectionsMax) * 100),
    b: Math.round((c.collectedEgp / collectionsMax) * 100),
  }));

  const velocitySeries = d.projects.map((p) => ({ label: p.name.slice(0, 3), value: toNumber(p.velocityPerWeek) }));
  const collectionRateSeries = d.collectionsByProject.map((c) => ({ label: (projectName.get(c.projectId) ?? c.projectId).slice(0, 3), value: c.collectionRatePct }));
  const avgVelocity = velocitySeries.length ? velocitySeries.reduce((s, v) => s + v.value, 0) / velocitySeries.length : 0;
  const avgCollectionRate = collectionRateSeries.length ? collectionRateSeries.reduce((s, v) => s + v.value, 0) / collectionRateSeries.length : 0;
  const totalOverdueEgp = d.collectionsByProject.reduce((s, c) => s + c.overdueEgp, 0);

  return (
    <PageContainer>
      <PageHeader
        title="Executive Dashboard"
        description={`Portfolio across ${d.projectCount} projects · ${d.totalUnits.toLocaleString()} units`}
        actions={
          <>
            <SegmentedControl value={range} onChange={setRange} options={RANGES} />
            <Button variant="secondary" size="sm" icon="download">
              Export
            </Button>
          </>
        }
      />

      <KpiStrip className="mb-3.5">
        <KpiTile label="Portfolio Value" value={formatEgp(d.totalValueEgp)} />
        <KpiTile label="Units Sold" value={d.soldUnits.toLocaleString()} />
        <KpiTile label="Available" value={d.availableUnits.toLocaleString()} />
        <KpiTile label="Revenue" value={formatEgp(d.revenueEgp)} />
        <KpiTile label="Avg. Sell-through" value={`${avgSellThrough.toFixed(1)}%`} />
      </KpiStrip>

      {(insights.data?.length ?? 0) > 0 && (
        <Card className="mb-3.5 border-primary-border">
          <div className="flex items-center gap-2 border-b border-primary-border bg-primary-surface-pale px-3 py-2">
            <Icon name="spark" size={14} className="text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">AI Insights</span>
            <span className="text-[10.5px] text-secondary">generated from live portfolio data</span>
            <div className="flex-1" />
            <button onClick={() => navigate("/copilot")} className="text-[11px] font-medium text-primary hover:underline">
              Open Copilot →
            </button>
          </div>
          <div className="grid grid-cols-1 gap-px bg-border-row md:grid-cols-3">
            {insights.data!.map((i) => (
              <InsightCard
                key={i.id}
                insight={{
                  id: i.id,
                  tag: i.tag,
                  tagTone: toneOf(i.tag),
                  confidence: i.confidence,
                  text: i.text,
                  detail: i.detail,
                  cta: i.cta,
                }}
                onAct={() => (i.targetRoute ? navigate(`/${i.targetRoute.replace("an_", "analytics/")}`) : undefined)}
                onDismiss={() => {
                  dismissInsight.mutate(i.id);
                  toast.push({ title: "Insight dismissed" });
                }}
              />
            ))}
          </div>
        </Card>
      )}

      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2.5 border-b border-border-row px-3 py-2.5">
            <span className="text-[11.5px] font-semibold">Due vs. Collected by Project</span>
            <span className="text-[10px] text-subtle">current period</span>
            <div className="flex-1" />
            <ChartLegend items={[{ label: "Due", color: "var(--color-chart-primary)" }, { label: "Collected", color: "var(--color-chart-secondary)" }]} />
          </div>
          {collectionBars.length > 0 ? <DualBarChart data={collectionBars} /> : <EmptyChart />}
        </Card>

        <Card>
          <CardHeader title="Inventory" subtitle={`${inventoryTotal.toLocaleString()} units`} />
          <div className="p-3">
            {inventorySegments.length > 0 ? <StackedBarLegend segments={inventorySegments} /> : <EmptyChart />}
          </div>
        </Card>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader title="Lead Conversion Funnel" />
          <div className="p-3">
            <Funnel stages={funnelStages} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Sales Velocity" subtitle="units / week, by project" />
          <div className="px-3 pt-3">
            <LineChart data={velocitySeries} />
          </div>
          <StatFooter items={[{ label: "Avg.", value: `${avgVelocity.toFixed(1)} u/wk` }]} />
        </Card>

        <Card>
          <CardHeader title="Collection Rate" subtitle="% of due collected, by project" />
          <div className="px-3 pt-3">
            <LineChart data={collectionRateSeries} color="var(--color-success)" />
          </div>
          <StatFooter items={[{ label: "Avg. rate", value: `${avgCollectionRate.toFixed(1)}%` }, { label: "Overdue", value: formatEgp(totalOverdueEgp), valueClassName: "text-danger" }]} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center border-b border-border-row px-3 py-2.5">
            <span className="flex-1 text-[11.5px] font-semibold">Project Performance</span>
            <CardLink to="/projects">All projects →</CardLink>
          </div>
          <div className="grid grid-cols-[1.4fr_.7fr_.8fr_.8fr_1.1fr] gap-2 border-b border-border-row bg-surface-subtle px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
            <div>Project</div>
            <div className="text-end">Sold</div>
            <div className="text-end">Revenue</div>
            <div className="text-end">Velocity</div>
            <div>Sell-through</div>
          </div>
          {d.projects.map((p) => {
            const vel = toNumber(p.velocityPerWeek);
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
                className="grid cursor-pointer grid-cols-[1.4fr_.7fr_.8fr_.8fr_1.1fr] items-center gap-2 border-b border-border-row px-3 py-2 last:border-0 hover:bg-surface-hover"
              >
                <div className="min-w-0">
                  <div className="truncate text-[11.5px] font-medium">{p.name}</div>
                </div>
                <div className="text-end font-mono text-[11px]">{p.soldUnits}</div>
                <div className="text-end font-mono text-[11px]">{formatEgp(p.revenueEgp)}</div>
                <div className={`text-end font-mono text-[11px] ${vel >= 9 ? "text-success" : "text-warning"}`}>{vel.toFixed(1)}/wk</div>
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

        <Card className="flex flex-col">
          <div className="flex items-center border-b border-border-row px-3 py-2.5">
            <span className="flex-1 text-[11.5px] font-semibold">Recent Activity</span>
          </div>
          <div className="max-h-[340px] flex-1 overflow-y-auto">
            {d.recentActivity.length === 0 && <div className="p-3 text-[11px] text-subtle">No activity logged yet.</div>}
            {d.recentActivity.map((a) => (
              <div key={a.id} className="flex gap-2 border-b border-border-row px-3 py-2 last:border-0">
                <span className="mt-1 size-1.5 flex-none rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] leading-snug">{a.subject}</div>
                  <div className="mt-0.5 text-[10px] text-subtle">
                    {team.byId.get(a.agentId) ?? a.agentId} · {timeAgo(a.occurredAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

function EmptyChart() {
  return <div className="flex h-[140px] items-center justify-center text-[11px] text-subtle">No data yet.</div>;
}
