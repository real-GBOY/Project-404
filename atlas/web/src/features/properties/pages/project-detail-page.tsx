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
import { StackedBarLegend } from "@/components/charts/funnel";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { UnitDrawer, type UnitDrawerData } from "@/components/domain/unit-drawer";
import { QuickCreateModal } from "@/components/tables/quick-create-modal";
import { useToast } from "@/lib/toast/toast-provider";
import { formatEgp, formatEgpExact, toNumber } from "@/lib/money";
import { titleCase } from "@/lib/text";
import { ApiError } from "@/config";
import { useAuth } from "@/features/auth/auth-provider";
import { useTeamDirectory } from "@/api/team";
import { useCustomers } from "@/api/crm";
import { useProjects, useBuildings, useUnits, useCreateBuilding, toBuildingViews, type BuildingView } from "@/api/properties";
import { useCollections, type CollectionRow } from "@/api/finance";
import { useCreateReservation } from "@/api/sales";
import { BuildingInventory, type RealUnit } from "../building-inventory";

const PROJECT_TABS = ["Overview", "Buildings", "Inventory", "Sales", "Financials", "Analytics"] as const;
type ProjectTab = (typeof PROJECT_TABS)[number];

const buildingColumns: DataColumn<BuildingView>[] = [
  { key: "building", label: "Building", flex: 1.3, render: (r) => TextCell({ value: r.building }) },
  { key: "floors", label: "Floors", width: 64, align: "end", render: (r) => TextCell({ value: r.floors, mono: true, weight: "normal" }) },
  { key: "units", label: "Units", width: 64, align: "end", render: (r) => TextCell({ value: r.units, mono: true, weight: "normal" }) },
  { key: "sold", label: "Sold", width: 64, align: "end", render: (r) => TextCell({ value: r.sold, mono: true, weight: "normal" }) },
  { key: "conversion", label: "Sell-through", width: 140, render: (r) => BarCell({ pct: r.conversionPct, label: `${r.conversionPct}%` }) },
  { key: "handover", label: "Handover", width: 90, render: (r) => TextCell({ value: r.handover, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 140, render: (r) => BadgeCell({ status: r.status }) },
];

function financialRows(revenueEgp: number, collection: CollectionRow | undefined): { label: string; value: string }[] {
  return [
    { label: "Contracted", value: formatEgp(revenueEgp) },
    { label: "Collected", value: formatEgp(collection?.collectedEgp ?? 0) },
    { label: "Overdue", value: formatEgp(collection?.overdueEgp ?? 0) },
    { label: "Collection rate", value: `${(collection?.collectionRatePct ?? 0).toFixed(1)}%` },
  ];
}

/**
 * Project Detail (`/projects/:id`): header + KPI strip + 6-tab panel, backed by real project/building/
 * unit/collections data. Sales-history and per-project lead-funnel/velocity trends aren't modeled in
 * this data set (no time-series snapshots, and leads aren't linked to a specific project) — those two
 * tabs show an honest empty state rather than fabricated numbers.
 */
export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<ProjectTab>(PROJECT_TABS[0]);
  const [selectedUnit, setSelectedUnit] = useState<RealUnit | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addBuildingOpen, setAddBuildingOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);

  const projects = useProjects();
  const buildings = useBuildings({ projectId: id });
  const units = useUnits({ projectId: id });
  const collections = useCollections();
  const customers = useCustomers();
  const team = useTeamDirectory();
  const createBuilding = useCreateBuilding();
  const createReservation = useCreateReservation();
  const auth = useAuth();

  const loading = projects.isLoading || buildings.isLoading || units.isLoading || collections.isLoading;

  if (loading) {
    return (
      <PageContainer>
        <RowsSkeleton rows={6} cols={4} />
      </PageContainer>
    );
  }

  const error = projects.error ?? buildings.error ?? units.error ?? collections.error;
  if (error) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load this project" message={error instanceof ApiError ? error.message : "The request failed."} />
      </PageContainer>
    );
  }

  const project = projects.data?.find((p) => p.id === id);

  if (!project) {
    return (
      <PageContainer>
        <EmptyState
          icon="project"
          title="Project not found"
          description={`No project matches "${id}".`}
          action={
            <Button size="sm" onClick={() => navigate("/projects")}>
              Back to Projects
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const buildingViews = toBuildingViews(buildings.data ?? [], units.data ?? [], () => project.name);
  const collectionRow = collections.data?.find((c) => c.projectId === id);
  const sellThroughPct = Math.round(toNumber(project.sellThroughPct));
  const inventorySegments = [
    { label: "Sold", n: project.soldUnits, pct: project.totalUnits ? Math.round((project.soldUnits / project.totalUnits) * 100) : 0, color: "var(--color-chart-primary)" },
    { label: "Reserved", n: project.reservedUnits, pct: project.totalUnits ? Math.round((project.reservedUnits / project.totalUnits) * 100) : 0, color: "var(--color-warning)" },
    { label: "Available", n: project.availableUnits, pct: project.totalUnits ? Math.round((project.availableUnits / project.totalUnits) * 100) : 0, color: "var(--color-success)" },
  ];

  function handleUnitClick(unit: RealUnit) {
    setSelectedUnit(unit);
    setDrawerOpen(true);
  }

  const customerName = (uid: string | null) => (uid ? customers.data?.find((c) => c.id === uid)?.name ?? uid : "Unassigned");
  const agentName = (uid: string | null) => (uid ? team.byId.get(uid) ?? uid : "Unassigned");

  const drawerUnit: UnitDrawerData | null = selectedUnit
    ? {
        code: selectedUnit.code,
        project: selectedUnit.projectName,
        building: selectedUnit.buildingName,
        type: selectedUnit.type,
        area: `${selectedUnit.areaSqm} m²`,
        status: selectedUnit.status,
        price: formatEgpExact(selectedUnit.basePriceEgp),
        paid: selectedUnit.status === "Sold" || selectedUnit.status === "Reserved" ? "—" : undefined,
        remaining: selectedUnit.status === "Sold" || selectedUnit.status === "Reserved" ? formatEgpExact(selectedUnit.basePriceEgp) : undefined,
        paidPct: 0,
        customer: selectedUnit.status === "Sold" || selectedUnit.status === "Reserved" ? customerName(selectedUnit.currentCustomerId) : undefined,
        agent: selectedUnit.status === "Sold" || selectedUnit.status === "Reserved" ? agentName(selectedUnit.currentAgentId) : undefined,
      }
    : null;

  return (
    <PageContainer>
      <Link to="/projects" className="mb-2 inline-flex items-center gap-1 text-[11px] text-secondary hover:text-foreground">
        <Icon name="chevron-left" size={12} /> Back to Projects
      </Link>

      <PageHeader
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={titleCase(project.status)} />
            <span>
              {project.location} · {project.developer}
            </span>
          </span>
        }
        actions={
          <Button size="sm" icon="plus" onClick={() => setAddBuildingOpen(true)}>
            Add Building
          </Button>
        }
        below={
          <div className="flex max-w-[320px] items-center gap-2">
            <ProgressBar value={sellThroughPct} height={8} className="flex-1" />
            <span className="flex-none font-mono text-[11px] text-secondary">{sellThroughPct}% sell-through</span>
          </div>
        }
      />

      <KpiStrip className="mb-3.5">
        <KpiTile label="Total Units" value={String(project.totalUnits)} compact />
        <KpiTile label="Sold" value={String(project.soldUnits)} compact />
        <KpiTile label="Reserved" value={String(project.reservedUnits)} compact />
        <KpiTile label="Available" value={String(project.availableUnits)} compact />
        <KpiTile label="Revenue" value={formatEgp(project.revenueEgp)} compact />
        <KpiTile label="Velocity" value={`${toNumber(project.velocityPerWeek).toFixed(1)}/wk`} compact />
      </KpiStrip>

      <TabBar value={tab} onChange={setTab} tabs={PROJECT_TABS} className="mb-3.5" />

      {tab === "Overview" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader title="Inventory Split" subtitle={`${project.totalUnits} units`} />
            <div className="p-3">
              <StackedBarLegend segments={inventorySegments} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Financial Position" />
            <div className="flex flex-col">
              {financialRows(project.revenueEgp, collectionRow).map((f) => (
                <div key={f.label} className="flex items-center justify-between border-b border-border-row px-3 py-2 last:border-0">
                  <span className="text-[11px] text-secondary">{f.label}</span>
                  <span className="font-mono text-[11px] font-semibold">{f.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "Buildings" && (
        <Card>
          <DataTable
            columns={buildingColumns}
            rows={buildingViews}
            rowKey={(r) => r.id}
            emptyTitle="No buildings yet"
            emptyDescription="Add a building to start tracking floors and inventory for this project."
          />
        </Card>
      )}

      {tab === "Inventory" && <BuildingInventory projectId={project.id} onUnitClick={handleUnitClick} />}

      {tab === "Sales" && (
        <Card>
          <EmptyState
            icon="payment"
            title="Sales history not tracked per-project yet"
            description="Monthly sales-by-period history isn't modeled in this data set — only current-period totals are available (see the KPI strip above)."
          />
        </Card>
      )}

      {tab === "Financials" && (
        <Card>
          <CardHeader title="Financial Position" />
          <div className="flex flex-col">
            {financialRows(project.revenueEgp, collectionRow).map((f) => (
              <div key={f.label} className="flex items-center justify-between border-b border-border-row px-3 py-2 last:border-0">
                <span className="text-[11px] text-secondary">{f.label}</span>
                <span className="font-mono text-[11px] font-semibold">{f.value}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "Analytics" && (
        <Card>
          <EmptyState
            icon="trend-up"
            title="Velocity and funnel trends aren't broken out per-project"
            description="Leads aren't linked to a specific project in this data set, so a per-project conversion funnel or velocity trend can't be computed honestly — see the portfolio-wide versions on the Executive Dashboard."
          />
        </Card>
      )}

      <UnitDrawer unit={drawerUnit} open={drawerOpen} onOpenChange={setDrawerOpen} onReserve={() => { setDrawerOpen(false); setReserveOpen(true); }} />

      <QuickCreateModal
        open={addBuildingOpen}
        onOpenChange={setAddBuildingOpen}
        config={{
          title: "Add Building",
          submitLabel: "Add Building",
          fields: [
            { name: "key", label: "Building Key", required: true, placeholder: "e.g. D" },
            { name: "name", label: "Name", required: true, placeholder: "e.g. Building D" },
            { name: "floors", label: "Floors", type: "number", required: true, placeholder: "12" },
            { name: "unitsPerFloor", label: "Units / Floor", type: "number", required: true, placeholder: "8" },
            { name: "handoverDate", label: "Handover Date", type: "date" },
          ],
          onSubmit: async (values) => {
            await createBuilding.mutateAsync({
              projectId: project.id,
              key: values.key,
              name: values.name,
              floors: Number(values.floors),
              unitsPerFloor: Number(values.unitsPerFloor),
              handoverDate: values.handoverDate || null,
            });
            toast.push({ kind: "success", title: "Building added", body: `${values.name} added to ${project.name}.` });
          },
        }}
      />

      <QuickCreateModal
        open={reserveOpen}
        onOpenChange={setReserveOpen}
        config={{
          title: "New Reservation",
          submitLabel: "Reserve Unit",
          fields: [
            {
              name: "unitId",
              label: "Unit",
              type: "select",
              required: true,
              defaultValue: selectedUnit?.status === "Available" ? selectedUnit.id : undefined,
              options: (units.data ?? []).filter((u) => u.status === "available").map((u) => ({ value: u.id, label: `${u.code} · ${u.unitType}` })),
            },
            { name: "customerId", label: "Customer", type: "select", required: true, options: (customers.data ?? []).map((c) => ({ value: c.id, label: c.name })) },
            { name: "depositEgp", label: "Deposit (EGP)", type: "number", required: true, placeholder: "150000" },
            { name: "agentId", label: "Agent", type: "select", required: true, defaultValue: auth.user?.id, options: team.members.map((m) => ({ value: m.id, label: m.name })) },
          ],
          onSubmit: async (values) => {
            await createReservation.mutateAsync({ unitId: values.unitId, customerId: values.customerId, agentId: values.agentId, depositEgp: Number(values.depositEgp) });
          },
        }}
      />
    </PageContainer>
  );
}
