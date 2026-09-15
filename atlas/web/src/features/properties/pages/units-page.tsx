import { useState } from "react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { UnitDrawer, type UnitDrawerData } from "@/components/domain/unit-drawer";
import { QuickCreateModal } from "@/components/tables/quick-create-modal";
import { formatEgpExact } from "@/lib/money";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/features/auth/auth-provider";
import { useTeamDirectory } from "@/api/team";
import { useCustomers } from "@/api/crm";
import { useProjects, useUnits } from "@/api/properties";
import { useCreateReservation } from "@/api/sales";
import { BuildingInventory, type RealUnit } from "../building-inventory";

function toUnitDrawerData(unit: RealUnit, customerName: (id: string | null) => string, agentName: (id: string | null) => string): UnitDrawerData {
  const hasOwner = unit.status === "Sold" || unit.status === "Reserved";
  return {
    code: unit.code,
    project: unit.projectName,
    building: unit.buildingName,
    type: unit.type,
    area: `${unit.areaSqm} m²`,
    status: unit.status,
    price: formatEgpExact(unit.basePriceEgp),
    paid: hasOwner ? "—" : undefined,
    remaining: hasOwner ? formatEgpExact(unit.basePriceEgp) : undefined,
    paidPct: 0,
    customer: hasOwner ? customerName(unit.currentCustomerId) : undefined,
    agent: hasOwner ? agentName(unit.currentAgentId) : undefined,
    holdReason:
      unit.status === "On Hold"
        ? "Held by the sales desk pending internal approval."
        : unit.status === "Unavailable"
          ? "Withheld from sale (show unit / developer retained)."
          : undefined,
  };
}

/**
 * Unit Inventory (`/units`): project chip-selector → building tabs → color legend → floor-by-floor
 * grid. The grid itself lives in `BuildingInventory`, shared with the Project Detail → Inventory tab.
 */
export function UnitsPage() {
  const projects = useProjects();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<RealUnit | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);

  const activeProjectId = projectId ?? projects.data?.[0]?.id ?? "";
  const allUnits = useUnits({ projectId: activeProjectId || undefined });
  const customers = useCustomers();
  const team = useTeamDirectory();
  const createReservation = useCreateReservation();
  const auth = useAuth();

  if (projects.isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Unit Inventory" />
        <RowsSkeleton rows={6} cols={4} />
      </PageContainer>
    );
  }

  if (projects.error) {
    return (
      <PageContainer>
        <PageHeader title="Unit Inventory" />
        <ErrorState title="Couldn't load projects" message={projects.error instanceof ApiError ? projects.error.message : "The request failed."} />
      </PageContainer>
    );
  }

  const customerName = (id: string | null) => (id ? customers.data?.find((c) => c.id === id)?.name ?? id : "Unassigned");
  const agentName = (id: string | null) => (id ? team.byId.get(id) ?? id : "Unassigned");
  const availableUnits = (allUnits.data ?? []).filter((u) => u.status === "available");

  function handleUnitClick(unit: RealUnit) {
    setSelectedUnit(unit);
    setDrawerOpen(true);
  }

  async function handleDrawerReserve() {
    if (!selectedUnit) return;
    setDrawerOpen(false);
    setReserveOpen(true);
  }

  return (
    <PageContainer>
      <PageHeader
        title="Unit Inventory"
        description={`${(allUnits.data ?? []).length.toLocaleString()} units in this project`}
        actions={
          <Button size="sm" icon="plus" onClick={() => setReserveOpen(true)}>
            Reserve Unit
          </Button>
        }
      />

      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {(projects.data ?? []).map((p) => (
          <Chip key={p.id} active={p.id === activeProjectId} onClick={() => setProjectId(p.id)}>
            {p.name}
          </Chip>
        ))}
      </div>

      {activeProjectId && <BuildingInventory projectId={activeProjectId} onUnitClick={handleUnitClick} />}

      <UnitDrawer
        unit={selectedUnit ? toUnitDrawerData(selectedUnit, customerName, agentName) : null}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onReserve={handleDrawerReserve}
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
              options: availableUnits.map((u) => ({ value: u.id, label: `${u.code} · ${u.unitType}` })),
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
