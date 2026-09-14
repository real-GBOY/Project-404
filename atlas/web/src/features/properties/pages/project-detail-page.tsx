import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { KpiStrip, KpiTile } from "@/components/ui/kpi-tile";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TabBar } from "@/components/ui/tabs";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/pill";
import { DataTable, TextCell, BadgeCell, BarCell } from "@/components/tables/data-table";
import type { DataColumn } from "@/components/tables/data-table";
import { DualBarChart, ChartLegend } from "@/components/charts/bar-chart";
import { LineChart, StatFooter } from "@/components/charts/line-chart";
import { Funnel } from "@/components/charts/funnel";
import { EmptyState } from "@/components/feedback/empty-state";
import { UnitDrawer } from "@/components/domain/unit-drawer";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useToast } from "@/lib/toast/toast-provider";
import {
  PROJECTS,
  NORTH_HILLS_FINANCIALS,
  NORTH_HILLS_SALES_HISTORY,
  PROJECT_TABS,
  type ProjectMonthlySalesFixture,
} from "@/mocks/fixtures/projects";
import { BUILDINGS_TABLE, type BuildingTableRowFixture } from "@/mocks/fixtures/buildings";
import { REVENUE_CHART } from "@/mocks/fixtures/dashboard";
import { CRM_FUNNEL } from "@/mocks/fixtures/pipeline-stages";
import { BuildingInventory } from "../building-inventory";
import { toUnitDrawerData, type GeneratedUnit } from "../generate-units";

// Same two 12-point series used app-wide (dashboard + analytics screens — see those fixtures' own
// comments); reused here for the Analytics/Financials tabs with an explicit "portfolio-wide, not
// project-scoped" caveat since the mock data has no per-project breakdown of these two series.
const VELOCITY_SERIES = [9.8, 10.4, 11.2, 10.9, 12, 12.6, 11.9, 13.4, 13.1, 14, 13.6, 14.2];
const COLLECTION_SERIES = [86, 88, 87, 90, 89, 91, 88, 92, 90, 93, 89, 91.3];

type ProjectTab = (typeof PROJECT_TABS)[number];

const buildingColumns: DataColumn<BuildingTableRowFixture>[] = [
  { key: "building", label: "Building", flex: 1.3, render: (r) => TextCell({ value: r.building }) },
  { key: "floors", label: "Floors", width: 64, align: "end", render: (r) => TextCell({ value: r.floors, mono: true, weight: "normal" }) },
  { key: "units", label: "Units", width: 64, align: "end", render: (r) => TextCell({ value: r.units, mono: true, weight: "normal" }) },
  { key: "sold", label: "Sold", width: 64, align: "end", render: (r) => TextCell({ value: r.sold, mono: true, weight: "normal" }) },
  { key: "conversion", label: "Sell-through", width: 140, render: (r) => BarCell({ pct: r.conversionPct, label: `${r.conversionPct}%` }) },
  { key: "handover", label: "Handover", width: 90, render: (r) => TextCell({ value: r.handover, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 140, render: (r) => BadgeCell({ status: r.status }) },
];

const salesColumns: DataColumn<ProjectMonthlySalesFixture>[] = [
  { key: "period", label: "Period", flex: 1, render: (r) => TextCell({ value: r.period, mono: true }) },
  { key: "units", label: "Units", width: 64, align: "end", render: (r) => TextCell({ value: r.units, mono: true, weight: "normal" }) },
  { key: "revenue", label: "Revenue", width: 110, align: "end", render: (r) => TextCell({ value: r.revenue, mono: true }) },
  { key: "avgDeal", label: "Avg. Deal", width: 100, align: "end", render: (r) => TextCell({ value: r.avgDeal, mono: true, weight: "normal" }) },
  { key: "velocity", label: "Velocity", width: 90, align: "end", render: (r) => TextCell({ value: r.velocity, mono: true, weight: "normal" }) },
];

/**
 * Project Detail (`/projects/:id`, PLAN §3 item 7): header + KPI strip + 6-tab panel. Only North
 * Hills carries authored sales-history/financials in the mock data (see projects.ts's gap note) —
 * every other project shows an honest empty state on those two panels rather than fabricated numbers.
 */
export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState<ProjectTab>(PROJECT_TABS[0]);
  const [selectedUnit, setSelectedUnit] = useState<GeneratedUnit | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const project = PROJECTS.find((p) => p.id === id);

  if (!project) {
    return (
      <PageContainer>
        <EmptyState
          icon="project"
          title="Project not found"
          description={`No project matches "${id}" in the mock data.`}
          action={
            <Button size="sm" onClick={() => navigate("/projects")}>
              Back to Projects
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const isNorthHills = project.id === "north-hills";
  const projectBuildings = BUILDINGS_TABLE.filter((b) => b.project === project.name);

  async function handleAddBuilding() {
    const ok = await confirm({
      title: `Add a building to ${project!.name}?`,
      body: "This is a mock action — no backend is connected yet.",
      cta: "Add building",
    });
    if (ok) toast.push({ kind: "success", title: "Building added", body: `A new building was queued for ${project!.name}.` });
  }

  function handleUnitClick(unit: GeneratedUnit) {
    setSelectedUnit(unit);
    setDrawerOpen(true);
  }

  async function handleDrawerReserve() {
    if (!selectedUnit) return;
    const ok = await confirm({
      title: `Reserve unit ${selectedUnit.code}?`,
      body: "This will mark the unit as Reserved and notify the sales desk. Mock action — no backend is connected yet.",
      cta: "Reserve unit",
    });
    if (ok) {
      toast.push({ kind: "success", title: "Unit reserved", body: `${selectedUnit.code} marked as Reserved.` });
      setDrawerOpen(false);
    }
  }

  return (
    <PageContainer>
      <Link to="/projects" className="mb-2 inline-flex items-center gap-1 text-[11px] text-secondary hover:text-foreground">
        <Icon name="chevron-left" size={12} /> Back to Projects
      </Link>

      <PageHeader
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={project.status} />
            <span>
              {project.location} · {project.developer}
            </span>
          </span>
        }
        actions={
          <Button size="sm" icon="plus" onClick={handleAddBuilding}>
            Add Building
          </Button>
        }
        below={
          <div className="flex max-w-[320px] items-center gap-2">
            <ProgressBar value={project.sellThroughPct} height={8} className="flex-1" />
            <span className="flex-none font-mono text-[11px] text-secondary">{project.sellThroughPct}% sell-through</span>
          </div>
        }
      />

      <KpiStrip className="mb-3.5">
        <KpiTile label="Total Units" value={String(project.totalUnits)} compact />
        <KpiTile label="Sold" value={String(project.soldUnits)} compact />
        <KpiTile label="Reserved" value={String(project.reservedUnits)} compact />
        <KpiTile label="Available" value={String(project.availableUnits)} compact />
        <KpiTile label="Revenue" value={`EGP ${project.revenueEgp}`} compact />
        <KpiTile label="Velocity" value={project.velocity} compact />
      </KpiStrip>

      <TabBar value={tab} onChange={setTab} tabs={PROJECT_TABS} className="mb-3.5" />

      {tab === "Overview" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex items-center gap-2.5 border-b border-border-row px-3 py-2.5">
              <span className="text-[11.5px] font-semibold">Revenue vs. Collections</span>
              <span className="text-[10px] text-subtle">relative units · trailing 12 months · portfolio-wide (simplification)</span>
              <div className="flex-1" />
              <ChartLegend
                items={[
                  { label: "Contracted", color: "var(--color-chart-primary)" },
                  { label: "Collected", color: "var(--color-chart-secondary)" },
                ]}
              />
            </div>
            <DualBarChart data={REVENUE_CHART.map((m) => ({ label: m.month, top: "", a: m.contracted, b: m.collected }))} />
          </Card>

          <Card>
            <CardHeader title="Financial Position" subtitle={isNorthHills ? undefined : "North Hills only in mock data"} />
            {isNorthHills ? (
              <div className="flex flex-col">
                {NORTH_HILLS_FINANCIALS.map((f) => (
                  <div key={f.label} className="flex items-center justify-between border-b border-border-row px-3 py-2 last:border-0">
                    <span className="text-[11px] text-secondary">{f.label}</span>
                    <span className="font-mono text-[11px] font-semibold">{f.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="doc"
                title="Financials not broken out yet"
                description="Per-project financial position is only modeled for North Hills in the current mock data — the real backend will provide this for every project."
              />
            )}
          </Card>
        </div>
      )}

      {tab === "Buildings" && (
        <Card>
          <DataTable
            columns={buildingColumns}
            rows={projectBuildings}
            rowKey={(r) => r.building}
            emptyTitle="No buildings yet"
            emptyDescription="Add a building to start tracking floors and inventory for this project."
          />
        </Card>
      )}

      {tab === "Inventory" && <BuildingInventory projectId={project.id} onUnitClick={handleUnitClick} />}

      {tab === "Sales" && (
        <Card>
          {isNorthHills ? (
            <DataTable columns={salesColumns} rows={NORTH_HILLS_SALES_HISTORY} rowKey={(r) => r.period} />
          ) : (
            <EmptyState
              icon="payment"
              title="Sales history not tracked per-project yet"
              description="Monthly sales-by-period history is only modeled for North Hills in the current mock data — the real backend will provide this for every project."
            />
          )}
        </Card>
      )}

      {tab === "Financials" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader title="Financial Position" subtitle={isNorthHills ? undefined : "North Hills only in mock data"} />
            {isNorthHills ? (
              <div className="flex flex-col">
                {NORTH_HILLS_FINANCIALS.map((f) => (
                  <div key={f.label} className="flex items-center justify-between border-b border-border-row px-3 py-2 last:border-0">
                    <span className="text-[11px] text-secondary">{f.label}</span>
                    <span className="font-mono text-[11px] font-semibold">{f.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="doc"
                title="Financials not broken out yet"
                description="Per-project financial position is only modeled for North Hills in the current mock data."
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Collection Trend" subtitle="% of due collected · portfolio-wide (simplification)" />
            <div className="px-3 pt-3">
              <LineChart data={COLLECTION_SERIES.map((v, i) => ({ label: String(i), value: v }))} color="var(--color-success)" />
            </div>
            <StatFooter
              items={[
                { label: "Collection rate", value: "91.3%" },
                { label: "Overdue", value: "EGP 42.6M", valueClassName: "text-danger" },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === "Analytics" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader title="Sales Velocity" subtitle="units / week · portfolio-wide series (simplification)" />
            <div className="px-3 pt-3">
              <LineChart data={VELOCITY_SERIES.map((v, i) => ({ label: String(i), value: v }))} />
            </div>
            <StatFooter
              items={[
                { label: "Current", value: "14.2 u/wk" },
                { label: "vs. last month", value: "+18.4%", valueClassName: "text-success" },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Lead Conversion Funnel" subtitle="portfolio-wide (simplification)" />
            <div className="p-3">
              <Funnel
                stages={CRM_FUNNEL.map((f) => ({ label: f.label, n: parseInt(f.count.replace(/,/g, ""), 10), rate: f.rate, pct: f.pct, color: f.color }))}
              />
            </div>
          </Card>
        </div>
      )}

      <UnitDrawer
        unit={selectedUnit ? toUnitDrawerData(selectedUnit) : null}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onReserve={handleDrawerReserve}
      />
    </PageContainer>
  );
}
