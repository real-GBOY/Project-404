import { useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { UnitDrawer } from "@/components/domain/unit-drawer";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useToast } from "@/lib/toast/toast-provider";
import { PROJECTS } from "@/mocks/fixtures/projects";
import { BuildingInventory } from "../building-inventory";
import { getProjectBuildings, toUnitDrawerData, type GeneratedUnit } from "../generate-units";

/**
 * Unit Inventory (`/units`, PLAN §3 item 5): project chip-selector → building tabs → color legend →
 * floor-by-floor grid. The grid itself lives in `BuildingInventory`, shared with the Project Detail →
 * Inventory tab so the floor-plate rendering isn't duplicated.
 */
export function UnitsPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [projectId, setProjectId] = useState(PROJECTS[0].id);
  const [selectedUnit, setSelectedUnit] = useState<GeneratedUnit | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const buildings = useMemo(() => getProjectBuildings(projectId), [projectId]);
  const totalUnits = useMemo(() => buildings.reduce((sum, b) => sum + b.allUnits.length, 0), [buildings]);

  function handleUnitClick(unit: GeneratedUnit) {
    setSelectedUnit(unit);
    setDrawerOpen(true);
  }

  async function handleReserveClick() {
    const ok = await confirm({
      title: "Reserve a unit",
      body: "This is a mock action — no backend is connected yet. Pick a unit from the grid to reserve it directly, or continue to queue a blind reservation for the sales desk.",
      cta: "Reserve unit",
    });
    if (ok) toast.push({ kind: "success", title: "Reservation queued", body: "The sales desk will confirm the next available unit." });
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
      <PageHeader
        title="Unit Inventory"
        description={`${totalUnits.toLocaleString()} units across ${buildings.length} building${buildings.length === 1 ? "" : "s"}`}
        actions={
          <Button size="sm" icon="plus" onClick={handleReserveClick}>
            Reserve Unit
          </Button>
        }
      />

      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {PROJECTS.map((p) => (
          <Chip key={p.id} active={p.id === projectId} onClick={() => setProjectId(p.id)}>
            {p.name}
          </Chip>
        ))}
      </div>

      <BuildingInventory projectId={projectId} onUnitClick={handleUnitClick} />

      <UnitDrawer
        unit={selectedUnit ? toUnitDrawerData(selectedUnit) : null}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onReserve={handleDrawerReserve}
      />
    </PageContainer>
  );
}
